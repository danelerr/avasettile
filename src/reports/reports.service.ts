import { Injectable } from '@nestjs/common';
import { AuditEvent } from '../audit/audit.types';
import { DatabaseService } from '../database/database.service';
import { PayInStatus, PayInSweepStatus } from '../payins/payins.types';
import { StorageService } from '../storage/storage.service';
import {
  AssetVolume,
  AuditTrailReport,
  InstitutionalSummaryReport,
  ReportBucket,
  SweepQueueItem,
  SweepQueueReport,
  WebhookDeliveriesReport,
} from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly storage: StorageService,
    private readonly database: DatabaseService,
  ) {}

  getInstitutionalSummary(): InstitutionalSummaryReport {
    const snapshot = this.storage.snapshot;
    return {
      generatedAt: new Date().toISOString(),
      payouts: {
        count: snapshot.payouts.length,
        byStatus: this.countBy(snapshot.payouts, (item) => item.status),
        volumeByAsset: this.sumBy(
          snapshot.payouts,
          (item) => item.asset,
          (item) => item.amount,
        ),
      },
      payins: {
        count: snapshot.payins.length,
        byStatus: this.countBy(snapshot.payins, (item) => item.status),
        byCollectionMode: this.countBy(
          snapshot.payins,
          (item) => item.collectionMode ?? 'derived-address',
        ),
        bySweepStatus: this.countBy(
          snapshot.payins,
          (item) => item.sweepStatus ?? 'pending',
        ),
        expectedVolumeByAsset: this.sumBy(
          snapshot.payins,
          (item) => item.asset,
          (item) => item.expectedAmount,
        ),
        receivedVolumeByAsset: this.sumBy(
          snapshot.payins,
          (item) => item.asset,
          (item) => item.receivedAmount,
        ),
        sweptVolumeByAsset: this.sumBy(
          snapshot.payins,
          (item) => item.asset,
          (item) => item.sweptAmount ?? '0',
        ),
      },
      settlements: {
        count: snapshot.settlements.length,
        byStatus: this.countBy(snapshot.settlements, (item) => item.status),
        fiatVolumeByCurrency: this.sumBy(
          snapshot.settlements,
          (item) => item.fiatCurrency,
          (item) => item.fiatAmount,
        ),
      },
      privateSettlements: {
        count: snapshot.privateSettlements.length,
        byStatus: this.countBy(
          snapshot.privateSettlements,
          (item) => item.status,
        ),
        byMode: this.countBy(snapshot.privateSettlements, (item) => item.mode),
      },
    };
  }

  getSweepQueue(): SweepQueueReport {
    const items: SweepQueueItem[] = this.storage.snapshot.payins
      .filter(
        (p) =>
          p.status === PayInStatus.Confirmed &&
          (p.sweepStatus === PayInSweepStatus.Pending ||
            p.sweepStatus === PayInSweepStatus.Failed),
      )
      .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
      .map((p) => ({
        id: p.id,
        externalId: p.externalId,
        depositAddress: p.depositAddress,
        asset: p.asset,
        receivedAmount: p.receivedAmount,
        receivedAmountAtomic: p.receivedAmountAtomic,
        sweepStatus: p.sweepStatus,
        sweepFailureReason: p.sweepFailureReason,
        confirmedAt: p.confirmedAt,
      }));

    return {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  }

  async getWebhookDeliveries(
    limit: number,
    onlyFailed?: boolean,
  ): Promise<WebhookDeliveriesReport> {
    const items = await this.database.loadRecentWebhookDeliveries(
      Math.min(limit, 500),
      onlyFailed,
    );
    return {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  }

  getAuditTrail(
    from?: string,
    to?: string,
    subjectId?: string,
    limit = 200,
  ): AuditTrailReport {
    let events: AuditEvent[] = this.storage.snapshot.auditEvents;

    if (subjectId) events = events.filter((e) => e.subjectId === subjectId);
    if (from) events = events.filter((e) => e.createdAt >= from);
    if (to) events = events.filter((e) => e.createdAt <= to);

    const sliced = events.slice(-Math.min(limit, 1000));

    return {
      generatedAt: new Date().toISOString(),
      count: sliced.length,
      events: sliced,
    };
  }

  private countBy<T>(
    items: T[],
    keySelector: (item: T) => string,
  ): ReportBucket {
    return items.reduce<ReportBucket>((accumulator, item) => {
      const key = keySelector(item);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
  }

  private sumBy<T>(
    items: T[],
    keySelector: (item: T) => string,
    valueSelector: (item: T) => string,
  ): AssetVolume {
    // Accumulate in integer cents to avoid floating-point rounding errors.
    const totalCents = items.reduce<Record<string, number>>(
      (accumulator, item) => {
        const key = keySelector(item);
        const cents = Math.round(parseFloat(valueSelector(item)) * 100);
        accumulator[key] = (accumulator[key] ?? 0) + cents;
        return accumulator;
      },
      {},
    );

    return Object.fromEntries(
      Object.entries(totalCents).map(([key, cents]) => [
        key,
        (cents / 100).toFixed(2),
      ]),
    );
  }
}
