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

function isLicenseError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return LICENSE_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
}

async function migrate() {
  const sql = postgres(connectionString!, { max: 1 });

  // Create migrations tracking table
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  const migrationsDir = resolve(__dirname, '../migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const alreadyApplied = await sql`
      SELECT 1 FROM _migrations WHERE filename = ${file} LIMIT 1
    `;
    if (alreadyApplied.length > 0) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    const migrationPath = resolve(migrationsDir, file);
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log(`Running ${file}...`);
    try {
      await sql.unsafe(migrationSql);
    } catch (err) {
      if (isLicenseError(err)) {
        console.warn(
          `⚠️  Skipping ${file}: requires TimescaleDB Community/Enterprise (not available in OSS)`
        );
        // Still mark as applied so it doesn't retry every time
        await sql`
          INSERT INTO _migrations (filename) VALUES (${file})
        `;
        continue;
      }
      throw err;
    }

    await sql`
      INSERT INTO _migrations (filename) VALUES (${file})
    `;
    console.log(`Applied ${file}`);
  }

  await sql.end();
  console.log('All migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
