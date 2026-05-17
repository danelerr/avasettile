import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { join } from 'node:path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { ConfigurationService } from '../configuration/configuration.service';
import type { StorageState } from '../storage/storage.types';
import { runSqlMigrations } from './migration-runner';

export type DatabaseReadiness = {
  driver: 'json' | 'postgres';
  configured: boolean;
  reachable: boolean;
  required: boolean;
  error?: string;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool | null;

  constructor(private readonly configuration: ConfigurationService) {
    const databaseUrl = this.configuration.databaseUrl;
    this.pool = databaseUrl
      ? new Pool({
          connectionString: databaseUrl,
          max: this.configuration.databaseMaxConnections,
          ssl: this.configuration.databaseSsl
            ? { rejectUnauthorized: false }
            : undefined,
        })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.pool || !this.configuration.databaseAutoMigrate) return;

    const results = await this.runMigrations();
    const applied = results.filter((result) => result.status === 'applied');
    if (applied.length > 0) {
      this.logger.log(
        `Applied database migrations: ${applied
          .map((result) => result.fileName)
          .join(', ')}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, values);
  }

  async runMigrations() {
    return runSqlMigrations(
      this.getPool(),
      join(process.cwd(), 'db', 'migrations'),
    );
  }

  async getReadiness(): Promise<DatabaseReadiness> {
    const driver = this.configuration.storageDriver;
    const required = driver === 'postgres';

    if (!this.pool) {
      return {
        driver,
        configured: false,
        reachable: driver === 'json',
        required,
        error: required
          ? 'AVASETTLE_DATABASE_URL is not configured.'
          : undefined,
      };
    }

    try {
      await this.pool.query('SELECT 1');
      return {
        driver,
        configured: true,
        reachable: true,
        required,
      };
    } catch (error) {
      return {
        driver,
        configured: true,
        reachable: false,
        required,
        error:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  async ensureRuntimeStateTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS avasettle_runtime_state (
        key TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_avasettle_runtime_state_updated_at
      ON avasettle_runtime_state;

      CREATE TRIGGER trg_avasettle_runtime_state_updated_at
      BEFORE UPDATE ON avasettle_runtime_state
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  async loadRuntimeState(key: string): Promise<StorageState | null> {
    const result = await this.query<{ state: StorageState }>(
      'SELECT state FROM avasettle_runtime_state WHERE key = $1',
      [key],
    );

    return result.rows[0]?.state ?? null;
  }

  async saveRuntimeState(key: string, state: StorageState): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_runtime_state (key, state)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key)
       DO UPDATE SET state = EXCLUDED.state`,
      [key, JSON.stringify(state)],
    );
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error(
        'PostgreSQL is not configured. Set AVASETTLE_DATABASE_URL.',
      );
    }

    return this.pool;
  }
}
