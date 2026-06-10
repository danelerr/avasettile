import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
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
        explorerBaseUrl:
          process.env.AVASETTLE_EXPLORER_BASE_URL ?? 'https://snowtrace.io',
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
      explorerBaseUrl:
        process.env.AVASETTLE_EXPLORER_BASE_URL ??
        'https://subnets-test.avax.network/c-chain',
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

  get storageFilePath(): string {
    return resolve(
      process.cwd(),
      process.env.AVASETTLE_STORAGE_FILE ?? 'data/avasettle-ledger.json',
    );
  }

  get storageDriver(): 'json' | 'postgres' {
    const value = process.env.AVASETTLE_STORAGE_DRIVER ?? 'json';
    if (value === 'json' || value === 'postgres') return value;

    throw new Error('AVASETTLE_STORAGE_DRIVER must be json or postgres.');
  }

  get databaseUrl(): string | null {
    const value =
      process.env.AVASETTLE_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
    return value.trim() || null;
  }

  get databaseConfigured(): boolean {
    return Boolean(this.databaseUrl);
  }

  get databaseSsl(): boolean {
    return this.readBoolean('AVASETTLE_DATABASE_SSL', false);
  }

  get databaseMaxConnections(): number {
    const value = this.readInt('AVASETTLE_DATABASE_MAX_CONNECTIONS', 5);
    if (value === 0) {
      throw new Error('AVASETTLE_DATABASE_MAX_CONNECTIONS must be at least 1.');
    }

    return value;
  }

  get databaseAutoMigrate(): boolean {
    return this.readBoolean('AVASETTLE_DATABASE_AUTO_MIGRATE', true);
  }

  get payInMnemonic(): string | null {
    return process.env.AVASETTLE_PAYIN_MNEMONIC?.trim() || null;
  }

  get payInDerivationAccount(): number {
    return this.readInt('AVASETTLE_PAYIN_DERIVATION_ACCOUNT', 0);
  }

  get payInLookbackBlocks(): bigint {
    return BigInt(this.readInt('AVASETTLE_PAYIN_LOOKBACK_BLOCKS', 50_000));
  }

  get payInDefaultExpirationMinutes(): number | null {
    const value = process.env.AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES;
    if (value === undefined || value === '') return null;

    const minutes = this.readInt(
      'AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES',
      0,
    );
    if (minutes === 0) return null;
    if (minutes > 10_080) {
      throw new Error(
        'AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES must be 10080 or lower.',
      );
    }

    return minutes;
  }

  get paymentRouterAddress(): `0x${string}` | null {
    return this.readAddress('AVASETTLE_PAYMENT_ROUTER_ADDRESS');
  }

  get paymentRouterConfigured(): boolean {
    return this.paymentRouterAddress !== null;
  }

  get privacyMode(): 'off' | 'metadata-redaction' | 'eerc-experimental' {
    const value = process.env.AVASETTLE_PRIVACY_MODE ?? 'off';
    if (
      value === 'off' ||
      value === 'metadata-redaction' ||
      value === 'eerc-experimental'
    ) {
      return value;
    }

    throw new Error(
      'AVASETTLE_PRIVACY_MODE must be off, metadata-redaction or eerc-experimental.',
    );
  }

  get eercContractAddress(): `0x${string}` | null {
    return this.readAddress('AVASETTLE_EERC_CONTRACT_ADDRESS');
  }

  get fiatSettlementCurrency(): string {
    return (process.env.AVASETTLE_SETTLEMENT_FIAT_CURRENCY ?? 'USD')
      .trim()
      .toUpperCase();
  }

  get fiatSettlementRate(): number {
    return this.readNumber('AVASETTLE_SETTLEMENT_FIAT_RATE', 1);
  }

  get riskReviewAmount(): number {
    return this.readNumber('AVASETTLE_RISK_REVIEW_AMOUNT', 10_000);
  }

  get riskRejectAmount(): number {
    return this.readNumber('AVASETTLE_RISK_REJECT_AMOUNT', 50_000);
  }

  get webhookUrl(): string | null {
    return process.env.AVASETTLE_WEBHOOK_URL?.trim() || null;
  }

  get webhookSecret(): string | null {
    return process.env.AVASETTLE_WEBHOOK_SECRET?.trim() || null;
  }

  get webhookRetryAttempts(): number {
    return this.readInt('AVASETTLE_WEBHOOK_RETRY_ATTEMPTS', 3);
  }

  get autoSweep(): boolean {
    return this.readBoolean('AVASETTLE_AUTO_SWEEP', false);
  }

  get autoReconcileIntervalSeconds(): number | null {
    const value = process.env.AVASETTLE_AUTO_RECONCILE_INTERVAL_SECONDS;
    if (!value) return null;
    const seconds = Number(value);
    if (!Number.isInteger(seconds) || seconds < 10) {
      throw new Error(
        'AVASETTLE_AUTO_RECONCILE_INTERVAL_SECONDS must be an integer >= 10.',
      );
    }
    return seconds;
  }

  get throttleRps(): number {
    return this.readInt('AVASETTLE_THROTTLE_RPS', 100);
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
    return (process.env.AVASETTLE_API_KEY ?? '').trim();
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

  private readNumber(name: string, fallback: number): number {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }

    return parsed;
  }
}
