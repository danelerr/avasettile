import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  AssetRuntimeConfig,
  NetworkSummary,
  SettlementAsset,
  SettlementNetwork,
} from './configuration.types';

@Injectable()
export class ConfigurationService {
  readonly serviceName = 'AvaSettle On-chain Provider';
  readonly version = '0.1.0';

  get env(): string {
    return process.env.NODE_ENV ?? 'development';
  }

  get port(): number {
    return this.readInt('PORT', 3001);
  }

  get corsOrigins(): string[] | true {
    const raw = process.env.AVASETTLE_CORS_ORIGINS;
    if (!raw || raw.trim() === '*') return true;
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get apiKeyConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  get treasuryConfigured(): boolean {
    return this.treasuryPrivateKey !== null;
  }

  get settlementNetwork(): SettlementNetwork {
    const value = process.env.AVASETTLE_NETWORK ?? 'avalanche-fuji';
    if (value === 'avalanche-fuji' || value === 'avalanche-mainnet') {
      return value;
    }

    throw new Error(
      `Invalid AVASETTLE_NETWORK "${value}". Use avalanche-fuji or avalanche-mainnet.`,
    );
  }

  get networkSummary(): NetworkSummary {
    const network = this.settlementNetwork;
    if (network === 'avalanche-mainnet') {
      return {
        key: network,
        chainId: 43114,
        name: 'Avalanche C-Chain',
        nativeTokenSymbol: 'AVAX',
        explorerBaseUrl: 'https://snowtrace.io',
        rpcUrl:
          process.env.AVASETTLE_RPC_URL ??
          'https://api.avax.network/ext/bc/C/rpc',
      };
    }

    return {
      key: network,
      chainId: 43113,
      name: 'Avalanche Fuji Testnet',
      nativeTokenSymbol: 'AVAX',
      explorerBaseUrl: 'https://testnet.snowtrace.io',
      rpcUrl:
        process.env.AVASETTLE_RPC_URL ??
        'https://api.avax-test.network/ext/bc/C/rpc',
    };
  }

  get enabledAssets(): SettlementAsset[] {
    const raw = process.env.AVASETTLE_ENABLED_ASSETS ?? 'USDC';
    const assets = raw
      .split(',')
      .map((asset) => asset.trim().toUpperCase())
      .filter(Boolean);

    const supported = new Set<SettlementAsset>(['USDC', 'USDT']);
    const enabled = assets.filter((asset): asset is SettlementAsset =>
      supported.has(asset as SettlementAsset),
    );

    return enabled.length > 0 ? enabled : ['USDC'];
  }

  get minConfirmations(): number {
    return this.readInt('AVASETTLE_MIN_CONFIRMATIONS', 2);
  }

  get waitForReceipt(): boolean {
    return this.readBoolean('AVASETTLE_WAIT_FOR_RECEIPT', false);
  }

  get treasuryPrivateKey(): `0x${string}` | null {
    const raw = process.env.AVASETTLE_TREASURY_PRIVATE_KEY;
    if (!raw) return null;
    return raw.startsWith('0x') ? (raw as `0x${string}`) : `0x${raw}`;
  }

  getAssetConfig(asset: SettlementAsset): AssetRuntimeConfig {
    const symbol = asset.toUpperCase() as SettlementAsset;
    const address = this.readAddress(`AVASETTLE_${symbol}_ADDRESS`);
    const decimals = this.readInt(
      `AVASETTLE_${symbol}_DECIMALS`,
      symbol === 'USDC' || symbol === 'USDT' ? 6 : 18,
    );
    const maxPayoutAmount =
      process.env[`AVASETTLE_MAX_PAYOUT_${symbol}`] ??
      process.env.AVASETTLE_MAX_PAYOUT_AMOUNT ??
      null;

    return {
      symbol,
      address,
      decimals,
      maxPayoutAmount,
      configured: Boolean(address),
    };
  }

  getConfiguredAssets(): AssetRuntimeConfig[] {
    return this.enabledAssets.map((asset) => this.getAssetConfig(asset));
  }

  validateApiKey(candidate: string | undefined): boolean {
    const expected = this.apiKey;
    if (!expected || !candidate) return false;

    const expectedHash = createHash('sha256').update(expected).digest();
    const candidateHash = createHash('sha256').update(candidate).digest();
    return timingSafeEqual(expectedHash, candidateHash);
  }

  private get apiKey(): string {
    return (
      process.env.AVASETTLE_API_KEY ??
      process.env.CHAIN_FLOW_API_KEY ??
      ''
    ).trim();
  }

  private readAddress(name: string): `0x${string}` | null {
    const value = process.env[name]?.trim();
    if (!value) return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error(`${name} must be a valid EVM address.`);
    }

    return value as `0x${string}`;
  }

  private readBoolean(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (value === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private readInt(name: string, fallback: number): number {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${name} must be a non-negative integer.`);
    }

    return parsed;
  }
}
