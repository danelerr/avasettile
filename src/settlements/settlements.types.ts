import type { SettlementAsset } from '../configuration/configuration.types';

export enum PrivateSettlementStatus {
  Recorded = 'recorded',
  Revealed = 'revealed',
}

export type PrivateSettlementRecord = {
  id: string;
  clientId: string | null;
  externalId: string;
  settlementId: `0x${string}`;
  settlementRef: `0x${string}`;
  commitment: `0x${string}`;
  asset: SettlementAsset;
  tokenAddress: `0x${string}`;
  amount: string;
  amountAtomic: string;
  counterparty: `0x${string}`;
  /** Blinding secret — kept server-side, never returned by the API. */
  nonce: `0x${string}`;
  status: PrivateSettlementStatus;
  transactionHash: `0x${string}` | null;
  revealTransactionHash: `0x${string}` | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Public projection: the commitment and the owner's own data, never the nonce. */
export type PrivateSettlementResponse = Omit<
  PrivateSettlementRecord,
  'nonce'
> & {
  idempotentReplay?: boolean;
};
