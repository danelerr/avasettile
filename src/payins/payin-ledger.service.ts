import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { payInToValues, rowToPayIn } from '../database/postgres-mapper';
import { buildPatchSet, PatchColumn } from '../database/sql-patch';
import { PayInRecord, PayInStatus, PayInSweepStatus } from './payins.types';

const PAYIN_COLUMNS = `
  id, client_id, external_id, chain_flow_request_id, status, network, chain_id, asset, token_address,
  collection_mode, deposit_address, derivation_index, router_address, router_invoice_id,
  expected_amount, expected_amount_atomic, received_amount, received_amount_atomic,
  sweep_status, sweep_tx_hash, swept_amount, swept_amount_atomic, swept_at, sweep_failure_reason,
  start_block, last_scanned_block, expires_at, accepted_at, acceptance_note,
  metadata, transfers, detected_at, confirmed_at, created_at, updated_at`;

const PATCH_COLUMNS: Record<string, PatchColumn> = {
  status: { column: 'status' },
  receivedAmount: { column: 'received_amount' },
  receivedAmountAtomic: { column: 'received_amount_atomic' },
  sweepStatus: { column: 'sweep_status' },
  sweepTransactionHash: { column: 'sweep_tx_hash' },
  sweptAmount: { column: 'swept_amount' },
  sweptAmountAtomic: { column: 'swept_amount_atomic' },
  sweptAt: { column: 'swept_at' },
  sweepFailureReason: { column: 'sweep_failure_reason' },
  lastScannedBlock: { column: 'last_scanned_block' },
  acceptedAt: { column: 'accepted_at' },
  acceptanceNote: { column: 'acceptance_note' },
  metadata: { column: 'metadata', json: true },
  transfers: { column: 'transfers', json: true },
  detectedAt: { column: 'detected_at' },
  confirmedAt: { column: 'confirmed_at' },
};

export type PayInUpdateGuard = {
  /** Only apply the patch when the row is currently in one of these statuses. */
  expectedStatus?: PayInStatus[];
  /** Only apply the patch when the sweep is currently in one of these states. */
  expectedSweepStatus?: PayInSweepStatus[];
};

@Injectable()
export class PayInLedgerService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Inserts the record unless the client already has a pay-in with the same
   * externalId, in which case the existing record is returned. Uniqueness is
   * enforced by the (client_id, external_id) index, so concurrent requests
   * cannot create duplicates.
   */
  async createOrGetExisting(
    record: PayInRecord,
  ): Promise<{ record: PayInRecord; existed: boolean }> {
    const result = await this.database.query(
      `INSERT INTO avasettle_payins (${PAYIN_COLUMNS})
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
         $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30::jsonb,$31::jsonb,$32,$33,$34,$35
       )
       ON CONFLICT (client_id, external_id) DO NOTHING
       RETURNING ${PAYIN_COLUMNS}`,
      payInToValues(record),
    );
    if (result.rows[0]) {
      return { record: rowToPayIn(result.rows[0]), existed: false };
    }

    const existing = await this.findByExternalId(
      record.clientId,
      record.externalId,
    );
    if (!existing) {
      throw new Error(
        `Pay-in insert conflicted but no existing record found for externalId "${record.externalId}".`,
      );
    }
    return { record: existing, existed: true };
  }

  async findById(id: string, clientId?: string): Promise<PayInRecord | null> {
    const result = await this.database.query(
      `SELECT ${PAYIN_COLUMNS} FROM avasettle_payins
       WHERE id = $1 ${clientId ? 'AND client_id = $2' : ''}`,
      clientId ? [id, clientId] : [id],
    );
    return result.rows[0] ? rowToPayIn(result.rows[0]) : null;
  }

  async findByExternalId(
    clientId: string | null,
    externalId: string,
  ): Promise<PayInRecord | null> {
    const result = await this.database.query(
      `SELECT ${PAYIN_COLUMNS} FROM avasettle_payins
       WHERE external_id = $1 AND client_id IS NOT DISTINCT FROM $2`,
      [externalId, clientId],
    );
    return result.rows[0] ? rowToPayIn(result.rows[0]) : null;
  }

  async list(filters: {
    clientId?: string;
    status?: PayInStatus;
    externalId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PayInRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown): void => {
      values.push(value);
      conditions.push(`${clause} $${values.length}`);
    };

    if (filters.clientId) add('client_id =', filters.clientId);
    if (filters.status) add('status =', filters.status);
    if (filters.externalId) add('external_id =', filters.externalId);

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(filters.limit ?? 200);
    const limitParam = `$${values.length}`;
    values.push(filters.offset ?? 0);
    const offsetParam = `$${values.length}`;

    const result = await this.database.query(
      `SELECT ${PAYIN_COLUMNS} FROM avasettle_payins
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    return result.rows.map(rowToPayIn);
  }

  /**
   * Applies the patch in a single UPDATE statement. When a guard is given,
   * the row is only updated if it is still in the expected state — the
   * database arbitrates concurrent transitions, so callers can treat a null
   * result as "another request transitioned this record first".
   */
  async update(
    id: string,
    patch: Partial<PayInRecord>,
    guard?: PayInUpdateGuard,
  ): Promise<PayInRecord | null> {
    const values: unknown[] = [id];
    const set = buildPatchSet(patch, PATCH_COLUMNS, values);

    let where = 'id = $1';
    if (guard?.expectedStatus) {
      values.push(guard.expectedStatus);
      where += ` AND status = ANY($${values.length})`;
    }
    if (guard?.expectedSweepStatus) {
      values.push(guard.expectedSweepStatus);
      where += ` AND sweep_status = ANY($${values.length})`;
    }

    const result = await this.database.query(
      `UPDATE avasettle_payins SET ${set} WHERE ${where} RETURNING ${PAYIN_COLUMNS}`,
      values,
    );
    return result.rows[0] ? rowToPayIn(result.rows[0]) : null;
  }

  /**
   * Confirmed pay-ins whose funds still sit on the deposit address. The
   * updated_at threshold spaces retries out: every attempt (success or
   * failure) touches the row, so a persistently failing sweep is retried at
   * most once per cool-down window instead of burning gas on every run.
   */
  async listSweepRetryCandidates(
    limit: number,
    cooldownMinutes: number,
  ): Promise<PayInRecord[]> {
    const result = await this.database.query(
      `SELECT ${PAYIN_COLUMNS} FROM avasettle_payins
       WHERE status = $1
         AND sweep_status = ANY($2)
         AND updated_at < now() - ($3 || ' minutes')::interval
       ORDER BY confirmed_at ASC NULLS LAST
       LIMIT $4`,
      [
        PayInStatus.Confirmed,
        [PayInSweepStatus.Pending, PayInSweepStatus.Failed],
        cooldownMinutes,
        limit,
      ],
    );
    return result.rows.map(rowToPayIn);
  }

  async findByIdempotencyKey(
    clientId: string | null,
    key: string,
  ): Promise<PayInRecord | null> {
    const result = await this.database.query<{ record_id: string }>(
      'SELECT record_id FROM avasettle_idempotency_keys WHERE key = $1',
      [namespacedKey(clientId, key)],
    );
    if (!result.rows[0]) return null;
    return this.findById(result.rows[0].record_id);
  }

  async storeIdempotencyKey(
    clientId: string | null,
    key: string,
    recordId: string,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO avasettle_idempotency_keys (key, record_id)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [namespacedKey(clientId, key), recordId],
    );
  }
}

/** Idempotency keys are scoped per client by namespacing the stored key. */
function namespacedKey(clientId: string | null, key: string): string {
  return `${clientId ?? 'global'}:${key}`;
}
