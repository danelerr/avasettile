import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';
import { PayinsService } from '../payins/payins.service';
import { ReconciliationService } from './reconciliation.service';

const SWEEP_RETRY_BATCH = 5;

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
    private readonly payins: PayinsService,
  ) {}

  onApplicationBootstrap(): void {
    const intervalSeconds = this.configuration.autoReconcileIntervalSeconds;
    if (!intervalSeconds) return;

    this.logger.log(
      `Auto-reconciliation enabled — running every ${intervalSeconds}s.`,
    );

    this.timer = setInterval(() => void this.tick(), intervalSeconds * 1_000);
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.reconciliation.run(SYSTEM_CONTEXT);
      if (result.payinsChecked > 0 || result.payoutsChecked > 0) {
        this.logger.log(
          `Auto-reconcile: checked ${result.payinsChecked} payins, ${result.payoutsChecked} payouts.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Auto-reconcile run failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Funds stuck on deposit addresses: retry top-up + sweep for confirmed
    // pay-ins whose sweep is still pending or previously failed.
    if (!this.configuration.autoSweep) return;
    try {
      const retried = await this.payins.retryPendingSweeps(
        SWEEP_RETRY_BATCH,
        SYSTEM_CONTEXT,
      );
      if (retried > 0) {
        this.logger.log(`Auto-sweep: retried ${retried} pending sweep(s).`);
      }
    } catch (error) {
      this.logger.warn(
        `Sweep retry batch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
