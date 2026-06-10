import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { OutboundHttpLogger } from '../observability/outbound-http-logger';

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
    private readonly http: OutboundHttpLogger,
  ) {}

  async fire(event: string, payload: Record<string, unknown>): Promise<void> {
    const url = this.configuration.webhookUrl;
    if (!url) return;

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

    const secret = this.configuration.webhookSecret;
    if (secret) {
      const sig = createHmac('sha256', secret).update(body).digest('hex');
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
        const response = await this.http.fetch(url, { method: 'POST', headers, body });
        if (response.ok) {
          void this.database.insertWebhookDelivery({
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
      `Webhook delivery failed for event "${event}" after ${attempts} attempt(s): ${lastError}`,
    );

    void this.database.insertWebhookDelivery({
      event,
      url,
      payload: fullPayload,
      success: false,
      attempts,
      lastError,
      deliveredAt: null,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
