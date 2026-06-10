import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { join } from 'node:path';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { ConfigurationService } from '../configuration/configuration.service';
import type { AuditEvent } from '../audit/audit.types';
import type { PayInRecord } from '../payins/payins.types';
import type { PayoutRecord } from '../payouts/payout.types';
import type { PrivateSettlementRecord } from '../privacy/privacy.types';
import type { SettlementRecord } from '../settlement/settlement.types';
import {
  auditEventToValues,
  payInToValues,
  payoutToValues,
  privateSettlementToValues,
  rowToAuditEvent,
  rowToPayIn,
  rowToPayout,
  rowToPrivateSettlement,
  rowToSettlement,
  settlementToValues,
} from './postgres-mapper';
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
        error: required ? 'AVASETTLE_DATABASE_URL is not configured.' : undefined,
      };
    }

    try {
      await this.pool.query('SELECT 1');
      return { driver, configured: true, reachable: true, required };
    } catch (error) {
      return {
        driver,
        configured: true,
        reachable: false,
        required,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  // ─── Derivation counter ─────────────────────────────────────────────────────

  async claimNextPayInIndex(): Promise<number | null> {
    try {
      const result = await this.query<{ idx: string }>(
        `UPDATE avasettle_counters
         SET value = value + 1, updated_at = now()
         WHERE key = 'payin_address_index'
         RETURNING value - 1 AS idx`,
      );
      if (result.rows.length === 0) return null;
      return parseInt(result.rows[0].idx, 10);
    } catch {
      return null;
    }
  }

  async loadPayInAddressIndex(): Promise<number> {
    try {
      const result = await this.query<{ value: string }>(
        `SELECT value FROM avasettle_counters WHERE key = 'payin_address_index'`,
      );
      return result.rows[0] ? parseInt(result.rows[0].value, 10) : 0;
    } catch {
      return 0;
    }
  }

  // ─── PayIn ──────────────────────────────────────────────────────────────────

  async loadAllPayIns(): Promise<PayInRecord[]> {
    const result = await this.query(
      'SELECT * FROM avasettle_payins ORDER BY created_at ASC',
    );
    return result.rows.map(rowToPayIn);
  }

  async upsertPayIn(p: PayInRecord): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_payins (
         id, external_id, chain_flow_request_id, status, network, chain_id, asset, token_address,
         collection_mode, deposit_address, derivation_index, router_address, router_invoice_id,
         expected_amount, expected_amount_atomic, received_amount, received_amount_atomic,
         sweep_status, sweep_tx_hash, swept_amount, swept_amount_atomic, swept_at, sweep_failure_reason,
         start_block, expires_at, accepted_at, acceptance_note,
         metadata, transfers, detected_at, confirmed_at, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
         $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29::jsonb,$30,$31,$32,$33
       ) ON CONFLICT (id) DO UPDATE SET
         status              = EXCLUDED.status,
         received_amount     = EXCLUDED.received_amount,
         received_amount_atomic = EXCLUDED.received_amount_atomic,
         sweep_status        = EXCLUDED.sweep_status,
         sweep_tx_hash       = EXCLUDED.sweep_tx_hash,
         swept_amount        = EXCLUDED.swept_amount,
         swept_amount_atomic = EXCLUDED.swept_amount_atomic,
         swept_at            = EXCLUDED.swept_at,
         sweep_failure_reason= EXCLUDED.sweep_failure_reason,
         accepted_at         = EXCLUDED.accepted_at,
         acceptance_note     = EXCLUDED.acceptance_note,
         metadata            = EXCLUDED.metadata,
         transfers           = EXCLUDED.transfers,
         detected_at         = EXCLUDED.detected_at,
         confirmed_at        = EXCLUDED.confirmed_at,
         updated_at          = now()`,
      payInToValues(p),
    );
  }

  // ─── Payout ─────────────────────────────────────────────────────────────────

  async loadAllPayouts(): Promise<PayoutRecord[]> {
    const result = await this.query(
      'SELECT * FROM avasettle_payouts ORDER BY created_at ASC',
    );
    return result.rows.map(rowToPayout);
  }

  async upsertPayout(p: PayoutRecord): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_payouts (
         id, external_id, chain_flow_request_id, status, network, chain_id, asset, token_address,
         amount, amount_atomic, beneficiary_address, beneficiary_name, treasury_address,
         transaction_hash, failure_reason, memo, metadata,
         authorized_at, broadcasted_at, confirmed_at, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22
       ) ON CONFLICT (id) DO UPDATE SET
         status           = EXCLUDED.status,
         treasury_address = EXCLUDED.treasury_address,
         transaction_hash = EXCLUDED.transaction_hash,
         failure_reason   = EXCLUDED.failure_reason,
         metadata         = EXCLUDED.metadata,
         authorized_at    = EXCLUDED.authorized_at,
         broadcasted_at   = EXCLUDED.broadcasted_at,
         confirmed_at     = EXCLUDED.confirmed_at,
         updated_at       = now()`,
      payoutToValues(p),
    );
  }

  // ─── AuditEvent ─────────────────────────────────────────────────────────────

  async loadAllAuditEvents(): Promise<AuditEvent[]> {
    const result = await this.query(
      'SELECT * FROM avasettle_audit_events ORDER BY created_at ASC',
    );
    return result.rows.map(rowToAuditEvent);
  }

  async insertAuditEvent(e: AuditEvent): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_audit_events (id, type, subject_id, actor, payload, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       ON CONFLICT (id) DO NOTHING`,
      auditEventToValues(e),
    );
  }

  // ─── Settlement ─────────────────────────────────────────────────────────────

  async loadAllSettlements(): Promise<SettlementRecord[]> {
    const result = await this.query(
      'SELECT * FROM avasettle_settlements ORDER BY created_at ASC',
    );
    return result.rows.map(rowToSettlement);
  }

  async upsertSettlement(s: SettlementRecord): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_settlements (
         id, source_type, source_id, status, asset,
         crypto_amount, fiat_currency, fiat_amount, fx_rate,
         rail, reference, metadata, completed_at, failure_reason, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         status         = EXCLUDED.status,
         completed_at   = EXCLUDED.completed_at,
         failure_reason = EXCLUDED.failure_reason,
         metadata       = EXCLUDED.metadata,
         updated_at     = now()`,
      settlementToValues(s),
    );
  }

  // ─── PrivateSettlement ───────────────────────────────────────────────────────

  async loadAllPrivateSettlements(): Promise<PrivateSettlementRecord[]> {
    const result = await this.query(
      'SELECT * FROM avasettle_private_settlements ORDER BY created_at ASC',
    );
    return result.rows.map(rowToPrivateSettlement);
  }

  async upsertPrivateSettlement(ps: PrivateSettlementRecord): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_private_settlements (
         id, external_id, mode, status, subject_type, subject_id, asset,
         public_amount, amount_commitment, counterparty_commitment,
         metadata_hash, eerc_contract_address, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         status                  = EXCLUDED.status,
         counterparty_commitment = EXCLUDED.counterparty_commitment,
         updated_at              = now()`,
      privateSettlementToValues(ps),
    );
  }

  // ─── Webhook deliveries ─────────────────────────────────────────────────────

  async insertWebhookDelivery(delivery: {
    event: string;
    url: string;
    payload: Record<string, unknown>;
    success: boolean;
    attempts: number;
    lastError: string | null;
    deliveredAt: string | null;
  }): Promise<void> {
    if (!this.pool) return;
    try {
      await this.query(
        `INSERT INTO avasettle_webhook_deliveries
           (event, url, payload, success, attempts, last_error, delivered_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
        [
          delivery.event,
          delivery.url,
          JSON.stringify(delivery.payload),
          delivery.success,
          delivery.attempts,
          delivery.lastError,
          delivery.deliveredAt,
        ],
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record webhook delivery: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async loadRecentWebhookDeliveries(
    limit: number,
    onlyFailed?: boolean,
  ): Promise<Array<{
    id: string;
    event: string;
    url: string;
    payload: Record<string, unknown>;
    success: boolean;
    attempts: number;
    lastError: string | null;
    deliveredAt: string | null;
    createdAt: string;
  }>> {
    if (!this.pool) return [];
    const whereClause = onlyFailed ? 'WHERE success = false' : '';
    const result = await this.query<{
      id: string;
      event: string;
      url: string;
      payload: Record<string, unknown>;
      success: boolean;
      attempts: number;
      last_error: string | null;
      delivered_at: string | null;
      created_at: string;
    }>(
      `SELECT id, event, url, payload, success, attempts, last_error, delivered_at, created_at
       FROM avasettle_webhook_deliveries
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      event: row.event,
      url: row.url,
      payload: row.payload,
      success: row.success,
      attempts: row.attempts,
      lastError: row.last_error,
      deliveredAt: row.delivered_at,
      createdAt: row.created_at,
    }));
  }

  // ─── Idempotency keys ───────────────────────────────────────────────────────

  async loadAllIdempotencyKeys(): Promise<Record<string, string>> {
    const result = await this.query<{ key: string; record_id: string }>(
      'SELECT key, record_id FROM avasettle_idempotency_keys',
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.key] = row.record_id;
    }
    return map;
  }

  async setIdempotencyKey(key: string, recordId: string): Promise<void> {
    await this.query(
      `INSERT INTO avasettle_idempotency_keys (key, record_id)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, recordId],
    );
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL is not configured. Set AVASETTLE_DATABASE_URL.');
    }
    return this.pool;
  }
}
