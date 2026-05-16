import type { SettlementAsset } from '../configuration/configuration.types';

export enum SettlementStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

export type SettlementSourceType = 'payout' | 'payin' | 'manual';

export type SettlementRecord = {
  id: string;
  sourceType: SettlementSourceType;
  sourceId: string;
  status: SettlementStatus;
  asset: SettlementAsset;
  cryptoAmount: string;
  fiatCurrency: string;
  fiatAmount: string;
  fxRate: string;
  rail: string;
  reference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failureReason: string | null;
};
