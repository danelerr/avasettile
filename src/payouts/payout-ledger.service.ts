import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { payoutToValues, rowToPayout } from '../database/postgres-mapper';
import { PayoutRecord, PayoutStatus } from './payout.types';

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

  async update(
    id: string,
    patch: Partial<PayoutRecord>,
  ): Promise<PayoutRecord | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const next: PayoutRecord = {
      ...current,
      ...patch,
      id: current.id,
      clientId: current.clientId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.database.query(
      `UPDATE avasettle_payouts SET
         status = $2, treasury_address = $3, transaction_hash = $4, failure_reason = $5,
         metadata = $6::jsonb, authorized_at = $7, broadcasted_at = $8, confirmed_at = $9,
         updated_at = $10
       WHERE id = $1`,
      [
        next.id,
        next.status,
        next.treasuryAddress,
        next.transactionHash,
        next.failureReason,
        JSON.stringify(next.metadata),
        next.authorizedAt,
        next.broadcastedAt,
        next.confirmedAt,
        next.updatedAt,
      ],
    );
    return next;
  }
}
