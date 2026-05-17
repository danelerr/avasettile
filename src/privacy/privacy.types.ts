import type { SettlementAsset } from '../configuration/configuration.types';

export enum PrivateSettlementStatus {
  Created = 'created',
  Submitted = 'submitted',
  Settled = 'settled',
  Failed = 'failed',
}

export type PrivateSettlementMode = 'metadata-redaction' | 'eerc-experimental';

export type PrivateSettlementRecord = {
  id: string;
  externalId: string;
  mode: PrivateSettlementMode;
  status: PrivateSettlementStatus;
  subjectType: 'payin' | 'payout' | 'settlement' | 'manual';
  subjectId: string | null;
  asset: SettlementAsset;
  publicAmount: string | null;
  amountCommitment: string;
  counterpartyCommitment: string | null;
  metadataHash: string;
  eercContractAddress: `0x${string}` | null;
  createdAt: string;
  updatedAt: string;
};
