import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { payoutToValues, rowToPayout } from '../database/postgres-mapper';
import { buildPatchSet, PatchColumn } from '../database/sql-patch';
import { PayoutRecord, PayoutStatus } from './payout.types';

const PATCH_COLUMNS: Record<string, PatchColumn> = {
  status: { column: 'status' },
  treasuryAddress: { column: 'treasury_address' },
  transactionHash: { column: 'transaction_hash' },
  failureReason: { column: 'failure_reason' },
  metadata: { column: 'metadata', json: true },
  authorizedAt: { column: 'authorized_at' },
  broadcastedAt: { column: 'broadcasted_at' },
  confirmedAt: { column: 'confirmed_at' },
};

const PAYOUT_COLUMNS = `
  id, client_id, external_id, chain_flow_request_id, status, network, chain_id, asset, token_address,
  amount, amount_atomic, beneficiary_address, beneficiary_name, treasury_address,
  transaction_hash, failure_reason, memo, metadata,
  authorized_at, broadcasted_at, confirmed_at, created_at, updated_at`;

@Injectable()
export class PayoutLedgerService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Inserts the payout unless the client already has one with the same
   * externalId; the (client_id, external_id) unique index makes creation
   * race-safe and idempotent.
   */
  async createOrGetExisting(
    record: PayoutRecord,
  ): Promise<{ record: PayoutRecord; existed: boolean }> {
    const result = await this.database.query(
      `INSERT INTO avasettle_payouts (${PAYOUT_COLUMNS})
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23
       )
       ON CONFLICT (client_id, external_id) DO NOTHING
       RETURNING ${PAYOUT_COLUMNS}`,
      payoutToValues(record),
    );
    if (result.rows[0]) {
      return { record: rowToPayout(result.rows[0]), existed: false };
    }

    const existing = await this.findByExternalId(
      record.clientId,
      record.externalId,
    );
    if (!existing) {
      throw new Error(
        `Payout insert conflicted but no existing record found for externalId "${record.externalId}".`,
      );
    }
    return { record: existing, existed: true };
  }

  async findById(id: string, clientId?: string): Promise<PayoutRecord | null> {
    const result = await this.database.query(
      `SELECT ${PAYOUT_COLUMNS} FROM avasettle_payouts
       WHERE id = $1 ${clientId ? 'AND client_id = $2' : ''}`,
      clientId ? [id, clientId] : [id],
    );
    return result.rows[0] ? rowToPayout(result.rows[0]) : null;
  }

  async findByExternalId(
    clientId: string | null,
    externalId: string,
  ): Promise<PayoutRecord | null> {
    const result = await this.database.query(
      `SELECT ${PAYOUT_COLUMNS} FROM avasettle_payouts
       WHERE external_id = $1 AND client_id IS NOT DISTINCT FROM $2`,
      [externalId, clientId],
    );
    return result.rows[0] ? rowToPayout(result.rows[0]) : null;
  }

  async list(filters: {
    clientId?: string;
    status?: PayoutStatus;
    externalId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PayoutRecord[]> {
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
      `SELECT ${PAYOUT_COLUMNS} FROM avasettle_payouts
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
    return result.rows.map(rowToPayout);
  }

  /**
   * Applies the patch in a single UPDATE statement. With `expectedStatus`,
   * the row is only updated while still in one of those statuses — this is
   * the database-level guard that makes lifecycle transitions race-safe
   * (e.g. two concurrent authorizations can never both broadcast).
   */
  async update(
    id: string,
    patch: Partial<PayoutRecord>,
    guard?: { expectedStatus?: PayoutStatus[] },
  ): Promise<PayoutRecord | null> {
    const values: unknown[] = [id];
    const set = buildPatchSet(patch, PATCH_COLUMNS, values);

    let where = 'id = $1';
    if (guard?.expectedStatus) {
      values.push(guard.expectedStatus);
      where += ` AND status = ANY($${values.length})`;
    }

    const result = await this.database.query(
      `UPDATE avasettle_payouts SET ${set} WHERE ${where} RETURNING ${PAYOUT_COLUMNS}`,
      values,
    );
    return result.rows[0] ? rowToPayout(result.rows[0]) : null;
  }
}
