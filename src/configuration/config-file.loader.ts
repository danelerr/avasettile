import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AssetConfig = {
  address?: string | null;
  decimals?: number;
  maxPayoutAmount?: string | null;
};

type ConfigFile = {
  network?: 'avalanche-fuji' | 'avalanche-mainnet';
  port?: number;
  rpcUrl?: string | null;
  explorerBaseUrl?: string | null;
  corsOrigins?: string | string[] | null;
  storage?: {
    driver?: 'json' | 'postgres';
    filePath?: string;
    database?: {
      ssl?: boolean;
      maxConnections?: number;
      autoMigrate?: boolean;
    };
  };
  payin?: {
    lookbackBlocks?: number;
    derivationAccount?: number;
    defaultExpirationMinutes?: number | null;
    paymentRouterAddress?: string | null;
  };
  assets?: {
    enabled?: string[];
    USDC?: AssetConfig;
    USDT?: AssetConfig;
  };
  blockchain?: {
    minConfirmations?: number;
    waitForReceipt?: boolean;
  };
  settlement?: {
    fiatCurrency?: string;
    fiatRate?: number;
  };
  risk?: {
    reviewAmount?: number;
    rejectAmount?: number;
  };
  webhook?: {
    url?: string | null;
    retryAttempts?: number;
  };
  autoReconcileIntervalSeconds?: number | null;
  autoSweep?: boolean;
  throttleRps?: number;
  privacy?: {
    mode?: 'off' | 'metadata-redaction' | 'eerc-experimental';
    eercContractAddress?: string | null;
  };
};

function mapToEnvVars(cfg: ConfigFile): Record<string, string> {
  const v: Record<string, string> = {};
  const set = (key: string, val: unknown): void => {
    if (val != null && val !== '') v[key] = String(val);
  };

  set('AVASETTLE_NETWORK', cfg.network);
  set('PORT', cfg.port);
  set('AVASETTLE_RPC_URL', cfg.rpcUrl);
  set('AVASETTLE_EXPLORER_BASE_URL', cfg.explorerBaseUrl);

  if (cfg.corsOrigins != null) {
    v['AVASETTLE_CORS_ORIGINS'] = Array.isArray(cfg.corsOrigins)
      ? cfg.corsOrigins.join(',')
      : cfg.corsOrigins;
  }

  set('AVASETTLE_STORAGE_DRIVER', cfg.storage?.driver);
  set('AVASETTLE_STORAGE_FILE', cfg.storage?.filePath);
  set('AVASETTLE_DATABASE_SSL', cfg.storage?.database?.ssl);
  set('AVASETTLE_DATABASE_MAX_CONNECTIONS', cfg.storage?.database?.maxConnections);
  set('AVASETTLE_DATABASE_AUTO_MIGRATE', cfg.storage?.database?.autoMigrate);

  set('AVASETTLE_PAYIN_LOOKBACK_BLOCKS', cfg.payin?.lookbackBlocks);
  set('AVASETTLE_PAYIN_DERIVATION_ACCOUNT', cfg.payin?.derivationAccount);
  set('AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES', cfg.payin?.defaultExpirationMinutes);
  set('AVASETTLE_PAYMENT_ROUTER_ADDRESS', cfg.payin?.paymentRouterAddress);

  if (cfg.assets?.enabled != null) {
    v['AVASETTLE_ENABLED_ASSETS'] = cfg.assets.enabled.join(',');
  }
  for (const symbol of ['USDC', 'USDT'] as const) {
    const asset = cfg.assets?.[symbol];
    set(`AVASETTLE_${symbol}_ADDRESS`, asset?.address);
    set(`AVASETTLE_${symbol}_DECIMALS`, asset?.decimals);
    set(`AVASETTLE_MAX_PAYOUT_${symbol}`, asset?.maxPayoutAmount);
  }

  set('AVASETTLE_MIN_CONFIRMATIONS', cfg.blockchain?.minConfirmations);
  set('AVASETTLE_WAIT_FOR_RECEIPT', cfg.blockchain?.waitForReceipt);

  set('AVASETTLE_SETTLEMENT_FIAT_CURRENCY', cfg.settlement?.fiatCurrency);
  set('AVASETTLE_SETTLEMENT_FIAT_RATE', cfg.settlement?.fiatRate);

  set('AVASETTLE_RISK_REVIEW_AMOUNT', cfg.risk?.reviewAmount);
  set('AVASETTLE_RISK_REJECT_AMOUNT', cfg.risk?.rejectAmount);

  set('AVASETTLE_WEBHOOK_URL', cfg.webhook?.url);
  set('AVASETTLE_WEBHOOK_RETRY_ATTEMPTS', cfg.webhook?.retryAttempts);

  set('AVASETTLE_AUTO_RECONCILE_INTERVAL_SECONDS', cfg.autoReconcileIntervalSeconds);
  set('AVASETTLE_AUTO_SWEEP', cfg.autoSweep);
  set('AVASETTLE_THROTTLE_RPS', cfg.throttleRps);

  set('AVASETTLE_PRIVACY_MODE', cfg.privacy?.mode);
  set('AVASETTLE_EERC_CONTRACT_ADDRESS', cfg.privacy?.eercContractAddress);

  return v;
}

/**
 * Loads a structured JSON config file and merges non-secret settings into
 * process.env. Env vars already set (by CI, Docker, or .env files) always
 * take precedence — the config file only fills in gaps.
 *
 * Reads AVASETTLE_CONFIG_FILE env var, falls back to ./config/avasettle.json.
 */
export function loadConfigFile(): void {
  const filePath = resolve(
    process.cwd(),
    process.env.AVASETTLE_CONFIG_FILE ?? 'config/avasettle.json',
  );
  if (!existsSync(filePath)) return;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    console.error(`[AvaSettle] Failed to read config file: ${filePath}`);
    return;
  }

  let parsed: ConfigFile;
  try {
    parsed = JSON.parse(raw) as ConfigFile;
  } catch {
    console.error(`[AvaSettle] Config file is not valid JSON: ${filePath}`);
    return;
  }

  const vars = mapToEnvVars(parsed);
  let applied = 0;
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied++;
    }
  }

  if (applied > 0) {
    console.log(`[AvaSettle] Loaded ${applied} settings from ${filePath}.`);
  }
}
