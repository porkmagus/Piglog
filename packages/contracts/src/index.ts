import { z } from 'zod';

export const logLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const ingestLogSchema = z.object({
  timestamp: z.string().datetime(),
  level: logLevelSchema,
  service: z.string().min(1).max(255),
  host: z.string().max(255).optional(),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().max(255).optional(),
});

export const ingestBatchSchema = z.object({
  logs: z.array(ingestLogSchema).min(1).max(1000),
});

export const queryLogsSchema = z.object({
  workspaceId: z.string(),
  sourceId: z.string().optional(),
  service: z.string().optional(),
  level: logLevelSchema.optional(),
  host: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  traceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(500),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type IngestLogInput = z.infer<typeof ingestLogSchema>;
export type IngestBatchInput = z.infer<typeof ingestBatchSchema>;
export type QueryLogsInput = z.infer<typeof queryLogsSchema>;

// Token-based search parser (legacy, kept for backward compat)
export interface SearchTokens {
  service?: string;
  level?: LogLevel;
  host?: string;
  traceId?: string;
  search?: string;
}

export function parseSearchTokens(input: string): SearchTokens {
  const tokens: SearchTokens = {};
  const parts: string[] = [];
  const regex = /(\w+):([^\s]+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const [, key, value] = match;
    if (key === 'service') tokens.service = value;
    if (key === 'level') {
      const upper = value.toUpperCase();
      if (['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(upper)) {
        tokens.level = upper as LogLevel;
      }
    }
    if (key === 'host') tokens.host = value;
    if (key === 'traceId') tokens.traceId = value;
  }

  // Everything else is free text search
  const remaining = input.replace(regex, '').trim();
  if (remaining) {
    tokens.search = remaining;
  }

  return tokens;
}

export function tokensToQueryString(tokens: SearchTokens): string {
  const parts: string[] = [];
  if (tokens.service) parts.push(`service:${tokens.service}`);
  if (tokens.level) parts.push(`level:${tokens.level.toLowerCase()}`);
  if (tokens.host) parts.push(`host:${tokens.host}`);
  if (tokens.traceId) parts.push(`traceId:${tokens.traceId}`);
  if (tokens.search) parts.push(tokens.search);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Advanced query parser (Lucene-style)
// ---------------------------------------------------------------------------

export type QueryClauseType =
  | 'field'
  | 'negate'
  | 'phrase'
  | 'regex'
  | 'metadata'
  | 'glob'
  | 'sql';

export interface QueryClause {
  type: QueryClauseType;
  field: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=' | '~' | 'ILIKE';
  value: string | RegExp;
  negated?: boolean;
}

export interface ParsedQuery {
  clauses: QueryClause[];
  booleans: ('AND' | 'OR')[];
  rawSql?: string;
  freeText?: string;
}

const KNOWN_FIELDS = new Set([
  'service', 'level', 'host', 'traceId', 'sourceId', 'message', 'meta',
]);

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === '"') {
      let end = input.indexOf('"', i + 1);
      if (end === -1) end = input.length;
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
    } else if (input[i] === '/' && i + 1 < input.length && input[i + 1] !== '/') {
      let end = input.indexOf('/', i + 2);
      while (end > i + 1 && input[end - 1] === '\\') end = input.indexOf('/', end + 1);
      if (end === -1) end = input.length;
      tokens.push(input.slice(i, end + 1));
      i = end + 1;
    } else if (/\s/.test(input[i])) {
      i++;
    } else {
      let end = i;
      while (end < input.length && !/\s/.test(input[end]) && input[end] !== '"' && input[end] !== '/') end++;
      tokens.push(input.slice(i, end));
      i = end;
    }
  }
  return tokens;
}

export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = { clauses: [], booleans: [] };
  const tokens = tokenize(input);
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR') {
      result.booleans.push(token.toUpperCase() as 'AND' | 'OR');
      i++;
      continue;
    }

    if (token.startsWith('"') && token.endsWith('"')) {
      result.clauses.push({
        type: 'phrase',
        field: 'message',
        operator: 'ILIKE',
        value: token.slice(1, -1),
      });
      i++;
      continue;
    }

    if (token.startsWith('/') && (token.endsWith('/') || token.length > 1)) {
      const inner = token.startsWith('message~/')
        ? token.slice(9, -1)
        : token.slice(1, -1);
      try {
        result.clauses.push({
          type: 'regex',
          field: token.startsWith('message~/') ? 'message' : 'message',
          operator: '~',
          value: new RegExp(inner),
        });
      } catch { /* skip invalid regex */ }
      i++;
      continue;
    }

    if (token.startsWith('sql:')) {
      result.rawSql = token.slice(4);
      i++;
      continue;
    }

    if (token.startsWith('-')) {
      const rest = token.slice(1);
      const clause = parseFieldToken(rest);
      if (clause) {
        clause.negated = true;
        result.clauses.push(clause);
      }
      i++;
      continue;
    }

    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const field = token.slice(0, colonIdx);
      const rawValue = token.slice(colonIdx + 1);

      if (field.startsWith('meta.')) {
        const metaKey = field.slice(5);
        const opMatch = rawValue.match(/^(>=|<=|>|<|!=|=)(.*)$/);
        if (opMatch) {
          result.clauses.push({
            type: 'metadata',
            field: metaKey,
            operator: opMatch[1] as QueryClause['operator'],
            value: opMatch[2],
          });
        } else {
          result.clauses.push({
            type: 'metadata',
            field: metaKey,
            operator: '=',
            value: rawValue,
          });
        }
        i++;
        continue;
      }

      if (KNOWN_FIELDS.has(field)) {
        const clause = parseFieldToken(token);
        if (clause) result.clauses.push(clause);
      } else {
        result.freeText = (result.freeText || '') + token + ' ';
      }
      i++;
      continue;
    }

    result.freeText = (result.freeText || '') + token + ' ';
    i++;
  }

  result.freeText = (result.freeText || '').trim();
  return result;
}

function parseFieldToken(token: string): QueryClause | null {
  const colonIdx = token.indexOf(':');
  if (colonIdx < 0) return null;

  const field = token.slice(0, colonIdx);
  const rawValue = token.slice(colonIdx + 1);

  if (rawValue.startsWith('/') && rawValue.endsWith('/')) {
    try {
      return {
        type: 'regex',
        field,
        operator: '~',
        value: new RegExp(rawValue.slice(1, -1)),
      };
    } catch { return null; }
  }

  if (rawValue.includes('*') || rawValue.includes('?') || rawValue.includes('[')) {
    return {
      type: 'glob',
      field,
      operator: 'ILIKE',
      value: rawValue.replace(/\*/g, '%').replace(/\?/g, '_'),
    };
  }

  return {
    type: 'field',
    field,
    operator: '=',
    value: rawValue,
  };
}

// Response schemas (contract tests)
export * from './schemas/index.js';
