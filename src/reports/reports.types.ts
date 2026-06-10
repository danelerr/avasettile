import { AuditEvent } from '../audit/audit.types';

export type ReportBucket = Record<string, number>;

export type AssetVolume = Record<string, string>;

export type SweepQueueItem = {
  id: string;
  externalId: string;
  depositAddress: string;
  asset: string;
  receivedAmount: string;
  receivedAmountAtomic: string;
  sweepStatus: string;
  sweepFailureReason: string | null;
  confirmedAt: string | null;
};

export type SweepQueueReport = {
  generatedAt: string;
  count: number;
  items: SweepQueueItem[];
};

export type AuditTrailReport = {
  generatedAt: string;
  count: number;
  events: AuditEvent[];
};

export type WebhookDeliveryRecord = {
  id: string;
  event: string;
  url: string;
  payload: Record<string, unknown>;
  success: boolean;
  attempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type WebhookDeliveriesReport = {
  generatedAt: string;
  count: number;
  items: WebhookDeliveryRecord[];
};

export type InstitutionalSummaryReport = {
  generatedAt: string;
  payouts: {
    count: number;
    byStatus: ReportBucket;
    volumeByAsset: AssetVolume;
  };
  payins: {
    count: number;
    byStatus: ReportBucket;
    byCollectionMode: ReportBucket;
    bySweepStatus: ReportBucket;
    expectedVolumeByAsset: AssetVolume;
    receivedVolumeByAsset: AssetVolume;
    sweptVolumeByAsset: AssetVolume;
  };
  settlements: {
    count: number;
    byStatus: ReportBucket;
    fiatVolumeByCurrency: AssetVolume;
  };
  privateSettlements: {
    count: number;
    byStatus: ReportBucket;
    byMode: ReportBucket;
  };
};
