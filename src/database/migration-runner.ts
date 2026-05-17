import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

export type MigrationResult = {
  fileName: string;
  status: 'applied' | 'skipped';
};

export async function runSqlMigrations(
  pool: Pool,
  migrationsDir: string,
): Promise<MigrationResult[]> {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS avasettle_schema_migrations (
      version TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  const results: MigrationResult[] = [];

  for (const fileName of files) {
    const version = fileName.replace(/\.sql$/, '');
    const filePath = join(migrationsDir, fileName);
    const sql = readFileSync(filePath, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    const existing = await pool.query<{ checksum: string }>(
      'SELECT checksum FROM avasettle_schema_migrations WHERE version = $1',
      [version],
    );

    if (existing.rowCount && existing.rows[0]?.checksum !== checksum) {
      throw new Error(
        `Migration ${fileName} was already applied with a different checksum.`,
      );
    }

    if (existing.rowCount) {
      results.push({ fileName, status: 'skipped' });
      continue;
    }

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(
        `INSERT INTO avasettle_schema_migrations (version, file_name, checksum)
         VALUES ($1, $2, $3)`,
        [version, fileName, checksum],
      );
      await pool.query('COMMIT');
      results.push({ fileName, status: 'applied' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  return results;
}
