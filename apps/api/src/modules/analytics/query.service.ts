import { db } from '@piglog/db';
import { sql } from 'drizzle-orm';

const DANGEROUS_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY', 'REINDEX', 'VACUUM',
];

const QUERY_CACHE = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 30_000;
const QUERY_TIMEOUT_MS = 5_000;
const MAX_ROWS = 1000;

export async function executeSandboxedQuery(
  workspaceId: string,
  userSql: string,
  timeRange: string = '24h',
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

  const hoursMap: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
  const hours = hoursMap[timeRange] || 24;
  const fromTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const cacheKey = `${workspaceId}:${userSql}:${timeRange}`;
  const cached = QUERY_CACHE.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as { columns: string[]; rows: unknown[][]; rowCount: number };
  }

  const wrappedQuery = sql.raw(`
    (
      SELECT * FROM (
        ${userSql}
      ) q
      WHERE workspace_id = '${workspaceId}'
        AND timestamp >= '${fromTime}'
      LIMIT ${MAX_ROWS}
    )
  `);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const result = await db.execute(wrappedQuery);
    const columns = Object.keys(result[0] || {});
    const rows = result.map((row: Record<string, unknown>) =>
      columns.map((col) => row[col])
    );

    const data = { columns, rows, rowCount: rows.length };
    QUERY_CACHE.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
