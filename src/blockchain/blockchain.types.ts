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

export type TransactionReconciliation = {
  hash: Hash;
  network: SettlementNetwork;
  status: 'pending' | 'success' | 'reverted';
  blockNumber: string | null;
  confirmations: number;
  finalized: boolean;
};
