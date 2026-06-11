import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ClientRecord } from '../clients/client.types';
import { ClientsRepository } from '../clients/clients.repository';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { OutboundHttpLogger } from '../observability/outbound-http-logger';

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];
const STUCK_DELIVERY_TIMEOUT = '5 minutes';

type OutboxRow = {
  id: string;
  client_id: string;
  event: string;
  payload: Record<string, unknown>;
  attempts: number;
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly clients: ClientsRepository,
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
    private readonly http: OutboundHttpLogger,
  ) {}

  /**
   * Persists the event in the outbox; the background dispatcher delivers it
   * with retries. Durable: once this row is written, the event survives
   * process crashes and is delivered at least once.
   *
   * Enqueue failures are logged but never propagated — a webhook must not
   * fail the business operation that already succeeded.
   */
  async enqueue(
    clientId: string | null,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!clientId) return;

    const fullPayload: Record<string, unknown> = {
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    try {
      await this.database.query(
        `INSERT INTO avasettle_webhook_outbox (client_id, event, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [clientId, event, JSON.stringify(fullPayload)],
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue webhook "${event}" for client ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Claims due outbox rows (FOR UPDATE SKIP LOCKED — safe across multiple
   * instances) and attempts one delivery per row. Failed attempts are
   * rescheduled with backoff until the configured attempt limit. Returns the
   * number of rows processed.
   */
  async dispatchDueEvents(batchSize = 10): Promise<number> {
    // Recover rows stuck in 'delivering' (process died mid-delivery).
    await this.database.query(
      `UPDATE avasettle_webhook_outbox
       SET status = 'pending'
       WHERE status = 'delivering'
         AND updated_at < now() - interval '${STUCK_DELIVERY_TIMEOUT}'`,
    );

    const claimed = await this.database.query<OutboxRow>(
      `UPDATE avasettle_webhook_outbox SET status = 'delivering'
       WHERE id IN (
         SELECT id FROM avasettle_webhook_outbox
         WHERE status = 'pending' AND next_attempt_at <= now()
         ORDER BY next_attempt_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, client_id, event, payload, attempts`,
      [batchSize],
    );

    for (const row of claimed.rows) {
      await this.deliverOnce(row);
    }
    return claimed.rows.length;
  }

  async listRecentDeliveries(
    clientId: string,
    limit: number,
    onlyFailed?: boolean,
  ): Promise<
    Array<{
      id: string;
      event: string;
      url: string;
      payload: Record<string, unknown>;
      success: boolean;
      attempts: number;
      lastError: string | null;
      deliveredAt: string | null;
      createdAt: string;
    }>
  > {
    const result = await this.database.query<{
      id: string;
      event: string;
      url: string;
      payload: Record<string, unknown>;
      success: boolean;
      attempts: number;
      last_error: string | null;
      delivered_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, event, url, payload, success, attempts, last_error, delivered_at, created_at
       FROM avasettle_webhook_deliveries
       WHERE client_id = $1 ${onlyFailed ? 'AND success = false' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      [clientId, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      event: row.event,
      url: row.url,
      payload: row.payload,
      success: row.success,
      attempts: row.attempts,
      lastError: row.last_error,
      deliveredAt: row.delivered_at
        ? new Date(row.delivered_at).toISOString()
        : null,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  private async deliverOnce(row: OutboxRow): Promise<void> {
    let client: ClientRecord | null = null;
    try {
      client = await this.clients.findById(row.client_id);
    } catch (error) {
      await this.reschedule(
        row,
        row.attempts + 1,
        error instanceof Error ? error.message : 'Failed to load client',
      );
      return;
    }

    const url = client?.webhookUrl;
    if (!client || client.status !== 'active' || !url) {
      await this.setStatus(
        row.id,
        'skipped',
        row.attempts,
        'Client has no active webhook endpoint.',
      );
      return;
    }

    const body = JSON.stringify(row.payload);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'AvaSettle-Webhook/1.0',
    };
    if (client.webhookSecret) {
      const sig = createHmac('sha256', client.webhookSecret)
        .update(body)
        .digest('hex');
      headers['x-avasettle-signature'] = `sha256=${sig}`;
    }

    const attempts = row.attempts + 1;
    const maxAttempts = Math.max(1, this.configuration.webhookRetryAttempts);

    let lastError: string;
    let retryable = true;
    try {
      const response = await this.http.fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      if (response.ok) {
        await this.setStatus(row.id, 'delivered', attempts, null);
        await this.recordDelivery({
          clientId: client.id,
          event: row.event,
          url,
          payload: row.payload,
          success: true,
          attempts,
          lastError: null,
          deliveredAt: new Date().toISOString(),
        });
        return;
      }
      lastError = `HTTP ${response.status}`;
      retryable = isRetryableStatus(response.status);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
    }

    if (!retryable || attempts >= maxAttempts) {
      this.logger.warn(
        `Webhook delivery failed for event "${row.event}" (client ${client.id}) after ${attempts} attempt(s): ${lastError}`,
      );
      await this.setStatus(row.id, 'failed', attempts, lastError);
      await this.recordDelivery({
        clientId: client.id,
        event: row.event,
        url,
        payload: row.payload,
        success: false,
        attempts,
        lastError,
        deliveredAt: null,
      });
      return;
    }

    await this.reschedule(row, attempts, lastError);
  }

  private async reschedule(
    row: OutboxRow,
    attempts: number,
    lastError: string,
  ): Promise<void> {
    const delayMs =
      RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
    await this.database.query(
      `UPDATE avasettle_webhook_outbox
       SET status = 'pending', attempts = $2, last_error = $3,
           next_attempt_at = now() + ($4 || ' milliseconds')::interval
       WHERE id = $1`,
      [row.id, attempts, lastError, delayMs],
    );
  }

  private async setStatus(
    id: string,
    status: 'delivered' | 'failed' | 'skipped',
    attempts: number,
    lastError: string | null,
  ): Promise<void> {
    await this.database.query(
      `UPDATE avasettle_webhook_outbox
       SET status = $2, attempts = $3, last_error = $4
       WHERE id = $1`,
      [id, status, attempts, lastError],
    );
  }

  private async recordDelivery(delivery: {
    clientId: string;
    event: string;
    url: string;
    payload: Record<string, unknown>;
    success: boolean;
    attempts: number;
    lastError: string | null;
    deliveredAt: string | null;
  }): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO avasettle_webhook_deliveries
           (client_id, event, url, payload, success, attempts, last_error, delivered_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
        [
          delivery.clientId,
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
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
