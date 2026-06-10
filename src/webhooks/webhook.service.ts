import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ClientRecord } from '../clients/client.types';
import { ClientsRepository } from '../clients/clients.repository';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { OutboundHttpLogger } from '../observability/outbound-http-logger';

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

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
   * Delivers an event to the webhook endpoint configured for the client that
   * owns the record. Clients without a webhook URL are skipped.
   */
  async fire(
    clientId: string | null,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!clientId) return;

    let client: ClientRecord | null = null;
    try {
      client = await this.clients.findById(clientId);
    } catch (error) {
      this.logger.warn(
        `Could not load client ${clientId} for webhook "${event}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return;
    }
    const url = client?.webhookUrl;
    if (!client || !url) return;

    const fullPayload: Record<string, unknown> = {
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    };
    const body = JSON.stringify(fullPayload);

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

    const maxAttempts = Math.max(1, this.configuration.webhookRetryAttempts);
    const delays = RETRY_DELAYS_MS.slice(0, maxAttempts - 1);

    let lastError: string | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await sleep(delays[attempt - 2]);
      }

      attempts = attempt;

      try {
        const response = await this.http.fetch(url, {
          method: 'POST',
          headers,
          body,
        });
        if (response.ok) {
          await this.recordDelivery({
            clientId: client.id,
            event,
            url,
            payload: fullPayload,
            success: true,
            attempts,
            lastError: null,
            deliveredAt: new Date().toISOString(),
          });
          return;
        }

        lastError = `HTTP ${response.status}`;
        if (!isRetryableStatus(response.status)) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Network error';
      }

      if (attempt < maxAttempts) {
        this.logger.debug(
          `Webhook attempt ${attempt}/${maxAttempts} failed (${lastError}). Retrying in ${delays[attempt - 1]}ms.`,
        );
      }
    }

    this.logger.warn(
      `Webhook delivery failed for event "${event}" (client ${client.id}) after ${attempts} attempt(s): ${lastError}`,
    );

    await this.recordDelivery({
      clientId: client.id,
      event,
      url,
      payload: fullPayload,
      success: false,
      attempts,
      lastError,
      deliveredAt: null,
    });
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
