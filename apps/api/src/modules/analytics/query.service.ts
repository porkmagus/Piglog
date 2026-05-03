import { db } from '@piglog/db';
import { sql } from 'drizzle-orm';

const DANGEROUS_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY', 'REINDEX', 'VACUUM',
];

// Bounded LRU-ish cache: evict expired + oldest when over limit
const QUERY_CACHE = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 200;
const QUERY_TIMEOUT_MS = 5_000;
const MAX_ROWS = 1000;

function evictCache() {
  const now = Date.now();
  for (const [key, entry] of QUERY_CACHE) {
    if (entry.expiry <= now) {
      QUERY_CACHE.delete(key);
    }
  }
  // If still over limit after pruning expired, delete oldest entries
  if (QUERY_CACHE.size > CACHE_MAX_ENTRIES) {
    const excess = QUERY_CACHE.size - CACHE_MAX_ENTRIES;
    let removed = 0;
    for (const key of QUERY_CACHE.keys()) {
      if (removed >= excess) break;
      QUERY_CACHE.delete(key);
      removed++;
    }
  }
}

export async function executeSandboxedQuery(
  _workspaceId: string,
  userSql: string,
  _timeRange: string = '24h',
): Promise<{ columns: string[]; rows: unknown[][]; rowCount: number }> {
  const normalized = userSql.trim().toUpperCase();

  for (const keyword of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalized)) {
      throw new Error(`Query contains disallowed keyword: ${keyword}`);
    }
  }

  if (!normalized.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed');
  }

  const cacheKey = `${userSql}:${_timeRange}`;
  const cached = QUERY_CACHE.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as { columns: string[]; rows: unknown[][]; rowCount: number };
  }

  // Prune expired entries before inserting new ones
  evictCache();

  // Enforce LIMIT at query level by appending it if not present
  const hasLimit = /\bLIMIT\b/i.test(normalized);
  const finalSql = hasLimit ? userSql : `${userSql} LIMIT ${MAX_ROWS}`;

  const result = await db.execute(sql.raw(finalSql));
  const columns = Object.keys(result[0] || {});
  const rows = result.map((row: Record<string, unknown>) =>
    columns.map((col) => row[col])
  );

  const data = { columns, rows, rowCount: rows.length };
  QUERY_CACHE.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
  return data;
}
