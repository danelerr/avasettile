import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const databaseUrl =
    process.env.AVASETTLE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('Set AVASETTLE_DATABASE_URL or DATABASE_URL.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl: ['1', 'true', 'yes', 'on'].includes(
      (process.env.AVASETTLE_DATABASE_SSL ?? '').toLowerCase(),
    )
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const result = await pool.query<{ now: Date }>('SELECT now()');
    console.log(`postgres: ok ${result.rows[0]?.now.toISOString()}`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
