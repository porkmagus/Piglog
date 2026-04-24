import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

const LICENSE_PATTERNS = [
  'not supported under the current',
  'functionality not supported',
];

const RETRYABLE_CODES = [
  'CONNECTION_CLOSED',
  'CONNECTION_FAILURE',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'NETWORK_DOWN',
];

function isLicenseError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return LICENSE_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
}

function isRetryableError(err: unknown): boolean {
  const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
  if (code && RETRYABLE_CODES.includes(code)) {
    return true;
  }

  const msg = String(err).toLowerCase();
  return (
    msg.includes('connection') &&
    (msg.includes('closed') ||
      msg.includes('refused') ||
      msg.includes('reset') ||
      msg.includes('timeout'))
  );
}

function createSqlClient() {
  return postgres(connectionString!, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 0,
  });
}

function previewStatement(statement: string): string {
  return statement
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 120) ?? '<empty statement>';
}

function readDollarQuoteTag(input: string, start: number): string | null {
  const match = /^\$[A-Za-z0-9_]*\$/.exec(input.slice(start));
  return match?.[0] ?? null;
}

function splitSqlStatements(input: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarQuoteTag: string | null = null;
  let lineComment = false;
  let blockCommentDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    current += char;

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockCommentDepth > 0) {
      if (char === '/' && next === '*') {
        blockCommentDepth += 1;
        current += next;
        i += 1;
      } else if (char === '*' && next === '/') {
        blockCommentDepth -= 1;
        current += next;
        i += 1;
      }
      continue;
    }

    if (dollarQuoteTag) {
      if (input.startsWith(dollarQuoteTag, i)) {
        for (let j = 1; j < dollarQuoteTag.length; j += 1) {
          current += input[i + j];
        }
        i += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      }
      continue;
    }

    if (inSingleQuote) {
      if (char === '\'' && next === '\'') {
        current += next;
        i += 1;
      } else if (char === '\'') {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        current += next;
        i += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      lineComment = true;
      current += next;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockCommentDepth = 1;
      current += next;
      i += 1;
      continue;
    }

    if (char === '\'') {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === '$') {
      const tag = readDollarQuoteTag(input, i);
      if (tag) {
        for (let j = 1; j < tag.length; j += 1) {
          current += input[i + j];
        }
        i += tag.length - 1;
        dollarQuoteTag = tag;
        continue;
      }
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
    }
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

async function ensureMigrationsTable(sql: ReturnType<typeof postgres>) {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function applyMigrationFile(file: string, migrationSql: string) {
  const statements = splitSqlStatements(migrationSql);
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const sql = createSqlClient();

    try {
      await ensureMigrationsTable(sql);

      const alreadyApplied = await sql`
        SELECT 1 FROM _migrations WHERE filename = ${file} LIMIT 1
      `;
      if (alreadyApplied.length > 0) {
        console.log(`Skipping ${file} (already applied)`);
        return;
      }

      console.log(`Running ${file} (${statements.length} statements)...`);

      for (let index = 0; index < statements.length; index += 1) {
        const statement = statements[index];
        const label = `${file} [${index + 1}/${statements.length}]`;

        try {
          await sql.unsafe(statement);
        } catch (err) {
          if (isLicenseError(err)) {
            console.warn(
              `Skipping ${file}: optional TimescaleDB feature not available at ${label}: ${previewStatement(statement)}`
            );
            await sql`
              INSERT INTO _migrations (filename) VALUES (${file})
            `;
            return;
          }

          console.error(`Failed at ${label}: ${previewStatement(statement)}`);
          throw err;
        }
      }

      await sql`
        INSERT INTO _migrations (filename) VALUES (${file})
      `;
      console.log(`Applied ${file}`);
      return;
    } catch (err) {
      if (!isRetryableError(err) || attempt === maxRetries) {
        throw err;
      }

      const delayMs = 2000 * 2 ** (attempt - 1);
      console.warn(
        `Retryable migration error while applying ${file} (attempt ${attempt}/${maxRetries}). Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      await sql.end().catch(() => undefined);
    }
  }
}

async function migrate() {
  const migrationsDir = resolve(__dirname, '../migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s)`);

  for (const file of files) {
    const migrationPath = resolve(migrationsDir, file);
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    await applyMigrationFile(file, migrationSql);
  }

  console.log('All migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
