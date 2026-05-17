import 'dotenv/config';
import { join } from 'node:path';
import { Pool } from 'pg';
import { runSqlMigrations } from './migration-runner';

async function main() {
  const databaseUrl =
    process.env.AVASETTLE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Set AVASETTLE_DATABASE_URL or DATABASE_URL.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.AVASETTLE_DATABASE_MAX_CONNECTIONS ?? 5),
    ssl: ['1', 'true', 'yes', 'on'].includes(
      (process.env.AVASETTLE_DATABASE_SSL ?? '').toLowerCase(),
    )
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const results = await runSqlMigrations(
      pool,
      join(process.cwd(), 'db', 'migrations'),
    );

    for (const result of results) {
      console.log(`${result.status}: ${result.fileName}`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
