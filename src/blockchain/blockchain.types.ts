import { Hash } from 'viem';
import {
  SettlementAsset,
  SettlementNetwork,
} from '../configuration/configuration.types';

export type TreasuryBalance = {
  asset: SettlementAsset;
  tokenAddress: `0x${string}`;
  decimals: number;
  balanceAtomic: string;
  balance: string;
};

export type NativeTreasuryBalance = {
  asset: 'AVAX';
  balanceAtomic: string;
  balance: string;
};

export type TransferExecution = {
  hash: Hash;
  status: 'broadcasted' | 'confirmed';
  blockNumber?: string;
};

export type SweepExecution = TransferExecution & {
  from: `0x${string}`;
  to: `0x${string}`;
  asset: SettlementAsset;
  amountAtomic: string;
  amount: string;
};

export type TransactionReconciliation = {
  hash: Hash;
  network: SettlementNetwork;
  status: 'pending' | 'success' | 'reverted';
  blockNumber: string | null;
  confirmations: number;
  finalized: boolean;
};

export type IncomingErc20Transfer = {
  hash: Hash;
  from: `0x${string}`;
  to: `0x${string}`;
  amountAtomic: string;
  amount: string;
  blockNumber: string;
};

export type PaymentRouterInvoicePayment = IncomingErc20Transfer & {
  invoiceId: `0x${string}`;
  payer: `0x${string}`;
  token: `0x${string}`;
  treasury: `0x${string}`;
};
