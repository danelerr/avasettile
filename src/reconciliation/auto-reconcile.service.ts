import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';
import { ReconciliationService } from './reconciliation.service';

const SYSTEM_CONTEXT = {
  clientId: null,
  clientName: null,
  correlationId: null,
  idempotencyKey: null,
  actor: 'auto-reconcile',
  sourceIp: null,
};

@Injectable()
export class AutoReconcileService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AutoReconcileService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly reconciliation: ReconciliationService,
    private readonly configuration: ConfigurationService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalSeconds = this.configuration.autoReconcileIntervalSeconds;
    if (!intervalSeconds) return;

    this.logger.log(
      `Auto-reconciliation enabled — running every ${intervalSeconds}s.`,
    );

    this.timer = setInterval(() => {
      this.reconciliation
        .run(SYSTEM_CONTEXT)
        .then((result) => {
          if (result.payinsChecked > 0 || result.payoutsChecked > 0) {
            this.logger.log(
              `Auto-reconcile: checked ${result.payinsChecked} payins, ${result.payoutsChecked} payouts.`,
            );
          }
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Auto-reconcile run failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        });
    }, intervalSeconds * 1_000);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
