import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import {
  AssetVolume,
  InstitutionalSummaryReport,
  ReportBucket,
} from './reports.types';

@Injectable()
export class ReportsService {
  constructor(private readonly storage: StorageService) {}

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
    const totals = items.reduce<Record<string, number>>((accumulator, item) => {
      const key = keySelector(item);
      accumulator[key] = (accumulator[key] ?? 0) + Number(valueSelector(item));
      return accumulator;
    }, {});

    return Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)]),
    );
  }
}
