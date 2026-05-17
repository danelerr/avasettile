import type {
  SettlementAsset,
  SettlementNetwork,
} from '../configuration/configuration.types';

export enum PayInStatus {
  Pending = 'pending',
  Detected = 'detected',
  Confirmed = 'confirmed',
  Expired = 'expired',
  Underpaid = 'underpaid',
  Overpaid = 'overpaid',
}

export enum PayInCollectionMode {
  DerivedAddress = 'derived-address',
  PaymentRouter = 'payment-router',
}

export enum PayInSweepStatus {
  NotRequired = 'not_required',
  Pending = 'pending',
  Broadcasted = 'broadcasted',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export type PayInTransferRecord = {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  amountAtomic: string;
  blockNumber: string;
};

export type PayInRecord = {
  id: string;
  externalId: string;
  chainFlowRequestId: string | null;
  status: PayInStatus;
  network: SettlementNetwork;
  chainId: number;
  asset: SettlementAsset;
  tokenAddress: `0x${string}`;
  expectedAmount: string;
  expectedAmountAtomic: string;
  receivedAmount: string;
  receivedAmountAtomic: string;
  depositAddress: `0x${string}`;
  derivationIndex: number;
  collectionMode: PayInCollectionMode;
  routerAddress: `0x${string}` | null;
  routerInvoiceId: `0x${string}` | null;
  startBlock: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  transfers: PayInTransferRecord[];
  sweepStatus: PayInSweepStatus;
  sweepTransactionHash: `0x${string}` | null;
  sweptAmount: string;
  sweptAmountAtomic: string;
  sweptAt: string | null;
  sweepFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
  detectedAt: string | null;
  confirmedAt: string | null;
};

export type PayInResponse = PayInRecord & {
  idempotentReplay?: boolean;
  auditTrail?: {
    type: string;
    createdAt: string;
    correlationId: string | null;
  }[];
};
