import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClientRecord, ClientStatus } from './client.types';

type Row = Record<string, unknown>;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return new Date(v).toISOString();
  return new Date().toISOString();
}

function rowToClient(row: Row): ClientRecord {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    status: row['status'] as ClientStatus,
    apiKeyPrefix: row['api_key_prefix'] as string,
    webhookUrl: (row['webhook_url'] as string | null) ?? null,
    webhookSecret: (row['webhook_secret'] as string | null) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: toIso(row['created_at']),
    updatedAt: toIso(row['updated_at']),
  };
}

const CLIENT_COLUMNS =
  'id, name, status, api_key_prefix, webhook_url, webhook_secret, metadata, created_at, updated_at';

@Injectable()
export class ClientsRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(input: {
    id: string;
    name: string;
    apiKeyHash: string;
    apiKeyPrefix: string;
    webhookUrl: string | null;
    webhookSecret: string | null;
    metadata: Record<string, unknown>;
  }): Promise<ClientRecord> {
    const result = await this.database.query(
      `INSERT INTO avasettle_clients
         (id, name, status, api_key_hash, api_key_prefix, webhook_url, webhook_secret, metadata)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7::jsonb)
       RETURNING ${CLIENT_COLUMNS}`,
      [
        input.id,
        input.name,
        input.apiKeyHash,
        input.apiKeyPrefix,
        input.webhookUrl,
        input.webhookSecret,
        JSON.stringify(input.metadata),
      ],
    );
    return rowToClient(result.rows[0]);
  }

  async findById(id: string): Promise<ClientRecord | null> {
    const result = await this.database.query(
      `SELECT ${CLIENT_COLUMNS} FROM avasettle_clients WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? rowToClient(result.rows[0]) : null;
  }

  async findActiveByApiKeyHash(
    apiKeyHash: string,
  ): Promise<ClientRecord | null> {
    const result = await this.database.query(
      `SELECT ${CLIENT_COLUMNS} FROM avasettle_clients
       WHERE api_key_hash = $1 AND status = 'active'`,
      [apiKeyHash],
    );
    return result.rows[0] ? rowToClient(result.rows[0]) : null;
  }

  async list(): Promise<ClientRecord[]> {
    const result = await this.database.query(
      `SELECT ${CLIENT_COLUMNS} FROM avasettle_clients ORDER BY created_at ASC`,
    );
    return result.rows.map(rowToClient);
  }

  async count(): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      'SELECT count(*) AS count FROM avasettle_clients',
    );
    return parseInt(result.rows[0].count, 10);
  }

  async update(
    id: string,
    patch: {
      name?: string;
      status?: ClientStatus;
      webhookUrl?: string | null;
      webhookSecret?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ClientRecord | null> {
    const result = await this.database.query(
      `UPDATE avasettle_clients SET
         name           = COALESCE($2, name),
         status         = COALESCE($3, status),
         webhook_url    = CASE WHEN $4 THEN $5 ELSE webhook_url END,
         webhook_secret = CASE WHEN $6 THEN $7 ELSE webhook_secret END,
         metadata       = COALESCE($8::jsonb, metadata),
         updated_at     = now()
       WHERE id = $1
       RETURNING ${CLIENT_COLUMNS}`,
      [
        id,
        patch.name ?? null,
        patch.status ?? null,
        patch.webhookUrl !== undefined,
        patch.webhookUrl ?? null,
        patch.webhookSecret !== undefined,
        patch.webhookSecret ?? null,
        patch.metadata !== undefined ? JSON.stringify(patch.metadata) : null,
      ],
    );
    return result.rows[0] ? rowToClient(result.rows[0]) : null;
  }

  async rotateApiKey(
    id: string,
    apiKeyHash: string,
    apiKeyPrefix: string,
  ): Promise<ClientRecord | null> {
    const result = await this.database.query(
      `UPDATE avasettle_clients SET
         api_key_hash   = $2,
         api_key_prefix = $3,
         updated_at     = now()
       WHERE id = $1
       RETURNING ${CLIENT_COLUMNS}`,
      [id, apiKeyHash, apiKeyPrefix],
    );
    return result.rows[0] ? rowToClient(result.rows[0]) : null;
  }
}
