import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set');
}

async function migrate() {
  const sql = postgres(connectionString, { max: 1 });

  const migrationPath = resolve(__dirname, '../migrations/0000_initial.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  console.log('Running migration...');
  await sql.unsafe(migrationSql);
  console.log('Migration complete.');

  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
