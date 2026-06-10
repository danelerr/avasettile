import {
  SettlementAsset,
  SettlementNetwork,
} from '../configuration/configuration.types';

export enum PayoutStatus {
  Prepared = 'prepared',
  Authorized = 'authorized',
  Broadcasted = 'broadcasted',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export type RequestContext = {
  clientId: string | null;
  clientName: string | null;
  correlationId: string | null;
  idempotencyKey: string | null;
  actor: string | null;
  sourceIp: string | null;
};

export type PayoutRecord = {
  id: string;
  clientId: string | null;
  externalId: string;
  chainFlowRequestId: string | null;
  status: PayoutStatus;
  network: SettlementNetwork;
  chainId: number;
  asset: SettlementAsset;
  tokenAddress: `0x${string}`;
  amount: string;
  amountAtomic: string;
  beneficiaryAddress: `0x${string}`;
  beneficiaryName: string | null;
  treasuryAddress: `0x${string}` | null;
  transactionHash: `0x${string}` | null;
  failureReason: string | null;
  memo: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  authorizedAt: string | null;
  broadcastedAt: string | null;
  confirmedAt: string | null;
};

export type PayoutResponse = PayoutRecord & {
  idempotentReplay?: boolean;
  auditTrail?: {
    type: string;
    createdAt: string;
    correlationId: string | null;
  }[];
};
