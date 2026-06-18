import type {
  SettlementAsset,
  SettlementNetwork,
} from '../configuration/configuration.types';
import type { PayInStatus } from '../payins/payins.types';

/**
 * Public, unauthenticated configuration the hosted checkout page needs to build
 * a payment: which network/token to use and where the PaymentRouter lives.
 * Contains no secrets and no per-tenant data.
 */
export type CheckoutConfig = {
  network: SettlementNetwork;
  chainId: number;
  networkName: string;
  explorerBaseUrl: string;
  demoEnabled: boolean;
  router: {
    address: `0x${string}` | null;
    configured: boolean;
  };
  token: {
    symbol: SettlementAsset;
    address: `0x${string}` | null;
    decimals: number;
  };
};

/** A single on-chain payment seen against a checkout invoice. */
export type CheckoutTransaction = {
  hash: `0x${string}`;
  amount: string;
  blockNumber: string;
};

/**
 * Safe, public projection of a pay-in for the hosted checkout. Deliberately
 * omits client identity, derivation index, sweep internals, metadata, and the
 * audit trail — only what the payer's browser needs to pay and track status.
 */
export type CheckoutSessionView = {
  id: string;
  status: PayInStatus;
  asset: SettlementAsset;
  amount: string;
  amountAtomic: string;
  receivedAmount: string;
  network: SettlementNetwork;
  chainId: number;
  tokenAddress: `0x${string}`;
  routerAddress: `0x${string}` | null;
  invoiceId: `0x${string}` | null;
  reference: string | null;
  explorerBaseUrl: string;
  transactions: CheckoutTransaction[];
  createdAt: string;
  expiresAt: string | null;
  detectedAt: string | null;
  confirmedAt: string | null;
};
