import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { join } from 'node:path';
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';
import { ConfigurationService } from '../configuration/configuration.service';
import { runSqlMigrations } from './migration-runner';

export type DatabaseReadiness = {
  configured: boolean;
  reachable: boolean;
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
            ? {
                rejectUnauthorized:
                  this.configuration.databaseSslRejectUnauthorized,
              }
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
        `Applied database migrations: ${applied.map((r) => r.fileName).join(', ')}`,
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

  /** Runs `work` inside a single transaction; rolls back on any error. */
  async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations() {
    return runSqlMigrations(
      this.getPool(),
      join(process.cwd(), 'db', 'migrations'),
    );
  }

  async getReadiness(): Promise<DatabaseReadiness> {
    if (!this.pool) {
      return {
        configured: false,
        reachable: false,
        error: 'AVASETTLE_DATABASE_URL is not configured.',
      };
    }

    try {
      await this.pool.query('SELECT 1');
      return { configured: true, reachable: true };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        error:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  // ─── Derivation counter ─────────────────────────────────────────────────────

  /**
   * Atomically claims the next pay-in derivation index. The SQL counter is the
   * single source of truth, so concurrent instances never derive the same
   * address.
   */
  async claimNextPayInIndex(): Promise<number> {
    const result = await this.query<{ idx: string }>(
      `UPDATE avasettle_counters
       SET value = value + 1, updated_at = now()
       WHERE key = 'payin_address_index'
       RETURNING value - 1 AS idx`,
    );
    if (result.rows.length === 0) {
      throw new Error(
        'Derivation counter row is missing. Run database migrations.',
      );
    }
    return parseInt(result.rows[0].idx, 10);
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
