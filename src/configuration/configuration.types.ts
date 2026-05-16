export type SettlementNetwork = 'avalanche-fuji' | 'avalanche-mainnet';

export type SettlementAsset = 'USDC' | 'USDT';

export type AssetRuntimeConfig = {
  symbol: SettlementAsset;
  address: `0x${string}` | null;
  decimals: number;
  maxPayoutAmount: string | null;
  configured: boolean;
};

export type NetworkSummary = {
  key: SettlementNetwork;
  chainId: 43113 | 43114;
  name: string;
  nativeTokenSymbol: 'AVAX';
  explorerBaseUrl: string;
  rpcUrl: string;
};
