import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { WebhookService } from './webhook.service';

/**
 * Periodically drains the webhook outbox. Multiple instances can run this
 * concurrently — row claiming uses FOR UPDATE SKIP LOCKED.
 */
@Injectable()
export class WebhookDispatcherService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
    private readonly webhooks: WebhookService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalSeconds = this.configuration.webhookDispatchIntervalSeconds;
    if (!intervalSeconds || !this.database.enabled) return;

    this.logger.log(
      `Webhook dispatcher enabled — draining outbox every ${intervalSeconds}s.`,
    );
    this.timer = setInterval(() => void this.tick(), intervalSeconds * 1_000);
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const processed = await this.webhooks.dispatchDueEvents();
      if (processed > 0) {
        this.logger.debug(`Dispatched ${processed} webhook event(s).`);
      }
    } catch (error) {
      this.logger.warn(
        `Webhook dispatch tick failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
