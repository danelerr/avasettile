// Shared shapes for the AvaSettle API. Mirrors the server's public responses;
// see docs/openapi.json for the full schema.

export type SettlementAsset = 'USDC' | 'USDT';
export type SettlementNetwork = 'avalanche-fuji' | 'avalanche-mainnet';
export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type PayInStatus =
  | 'pending'
  | 'detected'
  | 'confirmed'
  | 'expired'
  | 'underpaid'
  | 'overpaid';

export type PayInCollectionMode = 'derived-address' | 'payment-router';
export type PayInSweepStatus =
  | 'pending'
  | 'broadcasted'
  | 'confirmed'
  | 'failed'
  | 'not_required';

export type PayoutStatus =
  | 'prepared'
  | 'authorized'
  | 'broadcasted'
  | 'confirmed'
  | 'failed';

// ── Pay-ins ──────────────────────────────────────────────────────────────────

export interface CreatePayInInput {
  externalId: string;
  amount: string;
  asset: SettlementAsset;
  collectionMode?: PayInCollectionMode;
  routerInvoiceId?: Hex;
  chainFlowRequestId?: string;
  expiresInMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface PayIn {
  id: string;
  externalId: string;
  status: PayInStatus;
  network: SettlementNetwork;
  chainId: number;
  asset: SettlementAsset;
  tokenAddress: Address;
  expectedAmount: string;
  expectedAmountAtomic: string;
  receivedAmount: string;
  depositAddress: Address;
  collectionMode: PayInCollectionMode;
  routerAddress: Address | null;
  routerInvoiceId: Hex | null;
  sweepStatus: PayInSweepStatus;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
  [key: string]: unknown;
}

export interface ListPayInsQuery {
  status?: PayInStatus;
  externalId?: string;
  limit?: number;
  offset?: number;
}

// ── Payouts ──────────────────────────────────────────────────────────────────

export interface CreatePayoutInput {
  externalId: string;
  amount: string;
  asset: SettlementAsset;
  beneficiaryAddress: Address;
  beneficiaryName?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
  executeImmediately?: boolean;
}

export interface AuthorizePayoutInput {
  approvedBy?: string;
  riskDecisionId?: string;
  notes?: string;
}

export interface BatchAuthorizePayoutInput extends AuthorizePayoutInput {
  payoutIds: string[];
}

export interface Payout {
  id: string;
  externalId: string;
  status: PayoutStatus;
  asset: SettlementAsset;
  amount: string;
  amountAtomic: string;
  beneficiaryAddress: Address;
  transactionHash: Hex | null;
  failureReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
  [key: string]: unknown;
}

export interface ListPayoutsQuery {
  status?: PayoutStatus;
  externalId?: string;
  limit?: number;
  offset?: number;
}

// ── Clients (admin) ──────────────────────────────────────────────────────────

export interface CreateClientInput {
  name: string;
  webhookUrl?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateClientInput {
  name?: string;
  status?: 'active' | 'disabled';
  webhookUrl?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface Client {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  apiKeyPrefix: string;
  createdAt: string;
  [key: string]: unknown;
}

/** Returned only on create / rotate — the plaintext key is shown once. */
export interface ClientWithApiKey extends Client {
  apiKey: string;
}

// ── Checkout (public) ────────────────────────────────────────────────────────

export interface CheckoutConfig {
  network: SettlementNetwork;
  chainId: number;
  networkName: string;
  explorerBaseUrl: string;
  demoEnabled: boolean;
  router: { address: Address | null; configured: boolean };
  token: { symbol: SettlementAsset; address: Address | null; decimals: number };
}

export interface CreateCheckoutSessionInput {
  amount: string;
  asset?: SettlementAsset;
  reference?: string;
}

export interface CheckoutSession {
  id: string;
  status: PayInStatus;
  asset: SettlementAsset;
  amount: string;
  amountAtomic: string;
  receivedAmount: string;
  network: SettlementNetwork;
  chainId: number;
  tokenAddress: Address;
  routerAddress: Address | null;
  invoiceId: Hex | null;
  reference: string | null;
  explorerBaseUrl: string;
  transactions: { hash: Hex; amount: string; blockNumber: string }[];
  createdAt: string;
  confirmedAt: string | null;
  detectedAt: string | null;
}

// ── Confidential settlements ─────────────────────────────────────────────────

export interface CreateSettlementInput {
  externalId: string;
  asset: SettlementAsset;
  amount: string;
  counterparty: Address;
  metadata?: Record<string, unknown>;
}

export interface PrivateSettlement {
  id: string;
  externalId: string;
  status: 'recorded' | 'revealed';
  settlementId: Hex;
  commitment: Hex;
  asset: SettlementAsset;
  amount: string;
  counterparty: Address;
  transactionHash: Hex | null;
  revealTransactionHash: Hex | null;
  createdAt: string;
  [key: string]: unknown;
}

// ── Treasury / health ────────────────────────────────────────────────────────

export interface TreasuryStatus {
  network: SettlementNetwork;
  chainId: number;
  treasuryAddress: Address | null;
  enabledAssets: SettlementAsset[];
  [key: string]: unknown;
}

export interface TreasuryBalances {
  address: Address;
  network: SettlementNetwork;
  nativeBalance: string;
  nativeSymbol: string;
  tokenBalances: Record<string, string>;
}

export interface Readiness {
  status: 'ready' | 'degraded';
  checks: Record<string, boolean>;
  [key: string]: unknown;
}
