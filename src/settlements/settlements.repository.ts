import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  PrivateSettlementRecord,
  PrivateSettlementStatus,
} from './settlements.types';

type Row = Record<string, unknown>;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return new Date().toISOString();
}

const COLUMNS =
  'id, client_id, external_id, settlement_id, settlement_ref, commitment, asset, ' +
  'token_address, amount, amount_atomic, counterparty, nonce, status, ' +
  'transaction_hash, reveal_transaction_hash, metadata, created_at, updated_at';

function rowToRecord(row: Row): PrivateSettlementRecord {
  return {
    id: row['id'] as string,
    clientId: (row['client_id'] as string | null) ?? null,
    externalId: row['external_id'] as string,
    settlementId: row['settlement_id'] as `0x${string}`,
    settlementRef: row['settlement_ref'] as `0x${string}`,
    commitment: row['commitment'] as `0x${string}`,
    asset: row['asset'] as PrivateSettlementRecord['asset'],
    tokenAddress: row['token_address'] as `0x${string}`,
    amount: row['amount'] as string,
    amountAtomic: row['amount_atomic'] as string,
    counterparty: row['counterparty'] as `0x${string}`,
    nonce: row['nonce'] as `0x${string}`,
    status: row['status'] as PrivateSettlementStatus,
    transactionHash: (row['transaction_hash'] as `0x${string}` | null) ?? null,
    revealTransactionHash:
      (row['reveal_transaction_hash'] as `0x${string}` | null) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: toIso(row['created_at']),
    updatedAt: toIso(row['updated_at']),
  };
}

@Injectable()
export class SettlementsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Race-safe create: claims (client_id, external_id) or returns the existing row. */
  async createOrGetExisting(
    input: Omit<PrivateSettlementRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<{ record: PrivateSettlementRecord; existed: boolean }> {
    const inserted = await this.database.query(
      `INSERT INTO avasettle_private_settlements
         (id, client_id, external_id, settlement_id, settlement_ref, commitment,
          asset, token_address, amount, amount_atomic, counterparty, nonce,
          status, transaction_hash, reveal_transaction_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       ON CONFLICT (client_id, external_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        input.id,
        input.clientId,
        input.externalId,
        input.settlementId,
        input.settlementRef,
        input.commitment,
        input.asset,
        input.tokenAddress,
        input.amount,
        input.amountAtomic,
        input.counterparty,
        input.nonce,
        input.status,
        input.transactionHash,
        input.revealTransactionHash,
        JSON.stringify(input.metadata),
      ],
    );
    if (inserted.rows[0]) {
      return { record: rowToRecord(inserted.rows[0]), existed: false };
    }

    const existing = await this.database.query(
      `SELECT ${COLUMNS} FROM avasettle_private_settlements
       WHERE client_id = $1 AND external_id = $2`,
      [input.clientId, input.externalId],
    );
    return { record: rowToRecord(existing.rows[0]), existed: true };
  }

  async findById(
    id: string,
    clientId?: string,
  ): Promise<PrivateSettlementRecord | null> {
    const result = clientId
      ? await this.database.query(
          `SELECT ${COLUMNS} FROM avasettle_private_settlements
           WHERE id = $1 AND client_id = $2`,
          [id, clientId],
        )
      : await this.database.query(
          `SELECT ${COLUMNS} FROM avasettle_private_settlements WHERE id = $1`,
          [id],
        );
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async list(input: {
    clientId?: string;
    limit: number;
    offset: number;
  }): Promise<PrivateSettlementRecord[]> {
    const result = input.clientId
      ? await this.database.query(
          `SELECT ${COLUMNS} FROM avasettle_private_settlements
           WHERE client_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [input.clientId, input.limit, input.offset],
        )
      : await this.database.query(
          `SELECT ${COLUMNS} FROM avasettle_private_settlements
           ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [input.limit, input.offset],
        );
    return result.rows.map(rowToRecord);
  }

  async update(
    id: string,
    patch: {
      status?: PrivateSettlementStatus;
      transactionHash?: `0x${string}` | null;
      revealTransactionHash?: `0x${string}` | null;
    },
  ): Promise<PrivateSettlementRecord | null> {
    const result = await this.database.query(
      `UPDATE avasettle_private_settlements SET
         status                  = COALESCE($2, status),
         transaction_hash        = CASE WHEN $3 THEN $4 ELSE transaction_hash END,
         reveal_transaction_hash = CASE WHEN $5 THEN $6 ELSE reveal_transaction_hash END,
         updated_at              = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        patch.status ?? null,
        patch.transactionHash !== undefined,
        patch.transactionHash ?? null,
        patch.revealTransactionHash !== undefined,
        patch.revealTransactionHash ?? null,
      ],
    );
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    await this.database.query(
      'DELETE FROM avasettle_private_settlements WHERE id = $1',
      [id],
    );
  }
}
