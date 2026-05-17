-- AvaSettle PostgreSQL schema
-- Target: PostgreSQL / Firebase SQL Connect Cloud SQL
-- File: db/migrations/001_init_avasettle.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE avasettle_network AS ENUM (
    'avalanche-fuji',
    'avalanche-mainnet'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_symbol AS ENUM (
    'AVAX',
    'USDC',
    'USDT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payin_mode AS ENUM (
    'deposit_address',
    'payment_router',
    'eerc_private'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payin_status AS ENUM (
    'pending',
    'detected',
    'confirmed',
    'underpaid',
    'overpaid',
    'expired',
    'sweep_pending',
    'sweep_submitted',
    'sweep_confirmed',
    'sweep_failed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM (
    'prepared',
    'authorized',
    'broadcasted',
    'confirmed',
    'failed',
    'canceled',
    'needs_review'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blockchain_tx_type AS ENUM (
    'payin',
    'payout',
    'sweep',
    'gas_topup',
    'router_payin',
    'settlement',
    'eerc_private_payment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE blockchain_tx_status AS ENUM (
    'created',
    'submitted',
    'confirmed',
    'failed',
    'replaced',
    'dropped'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE settlement_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'canceled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE settlement_source_type AS ENUM (
    'payin',
    'payout',
    'manual',
    'router_payin',
    'eerc_private_payment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_actor_type AS ENUM (
    'system',
    'institution',
    'merchant',
    'chain_flow',
    'operator',
    'api_client'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE BUSINESS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  country_code CHAR(2),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_institutions_updated_at ON institutions;
CREATE TRIGGER trg_institutions_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  country_code CHAR(2),
  status TEXT NOT NULL DEFAULT 'active',
  settlement_currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, external_id)
);

DROP TRIGGER IF EXISTS trg_merchants_updated_at ON merchants;
CREATE TRIGGER trg_merchants_updated_at
BEFORE UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_used_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_api_clients_updated_at ON api_clients;
CREATE TRIGGER trg_api_clients_updated_at
BEFORE UPDATE ON api_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- CHAIN / ASSET CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,
  symbol asset_symbol NOT NULL,
  token_address TEXT,
  decimals INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, symbol),
  CONSTRAINT chk_assets_token_address CHECK (
    token_address IS NULL OR token_address ~* '^0x[a-f0-9]{40}$'
  )
);

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS treasury_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  purpose TEXT NOT NULL DEFAULT 'main_treasury',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, address),
  CONSTRAINT chk_treasury_address CHECK (address ~* '^0x[a-f0-9]{40}$')
);

DROP TRIGGER IF EXISTS trg_treasury_wallets_updated_at ON treasury_wallets;
CREATE TRIGGER trg_treasury_wallets_updated_at
BEFORE UPDATE ON treasury_wallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS derivation_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  current_index BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_derivation_counter_nonnegative CHECK (current_index >= 0)
);

DROP TRIGGER IF EXISTS trg_derivation_counters_updated_at ON derivation_counters;
CREATE TRIGGER trg_derivation_counters_updated_at
BEFORE UPDATE ON derivation_counters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO derivation_counters (name, current_index)
VALUES ('payin_address_index', 0)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PAY-INS
-- ============================================================

CREATE TABLE IF NOT EXISTS payin_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,

  external_id TEXT,
  invoice_id TEXT,

  mode payin_mode NOT NULL DEFAULT 'deposit_address',
  status payin_status NOT NULL DEFAULT 'pending',

  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,
  asset asset_symbol NOT NULL,
  token_address TEXT,
  decimals INTEGER NOT NULL DEFAULT 6,

  amount_expected NUMERIC(36, 18) NOT NULL,
  amount_expected_atomic NUMERIC(78, 0) NOT NULL,
  amount_detected NUMERIC(36, 18),
  amount_detected_atomic NUMERIC(78, 0),

  deposit_address TEXT,
  derivation_account INTEGER,
  derivation_index BIGINT,

  start_block BIGINT,
  paid_tx_hash TEXT,
  paid_block_number BIGINT,
  payer_address TEXT,

  sweep_destination TEXT,
  sweep_tx_hash TEXT,
  sweep_block_number BIGINT,
  sweep_error TEXT,

  expires_at TIMESTAMPTZ,

  settlement_currency TEXT,
  settlement_fx_rate NUMERIC(36, 18),
  settlement_fee_bps INTEGER,
  settlement_id UUID,

  risk_level risk_level,
  risk_score INTEGER,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_payin_amount_expected_positive CHECK (amount_expected > 0),
  CONSTRAINT chk_payin_amount_expected_atomic_positive CHECK (amount_expected_atomic > 0),
  CONSTRAINT chk_payin_deposit_address CHECK (
    deposit_address IS NULL OR deposit_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_payin_payer_address CHECK (
    payer_address IS NULL OR payer_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_payin_sweep_destination CHECK (
    sweep_destination IS NULL OR sweep_destination ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_payin_tx_hash CHECK (
    paid_tx_hash IS NULL OR paid_tx_hash ~* '^0x[a-f0-9]{64}$'
  ),
  CONSTRAINT chk_payin_sweep_tx_hash CHECK (
    sweep_tx_hash IS NULL OR sweep_tx_hash ~* '^0x[a-f0-9]{64}$'
  )
);

DROP TRIGGER IF EXISTS trg_payin_intents_updated_at ON payin_intents;
CREATE TRIGGER trg_payin_intents_updated_at
BEFORE UPDATE ON payin_intents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ux_payins_institution_external
ON payin_intents (institution_id, external_id)
WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payins_chain_deposit_address
ON payin_intents (chain_id, lower(deposit_address))
WHERE deposit_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payins_derivation_index
ON payin_intents (chain_id, derivation_account, derivation_index)
WHERE derivation_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_payins_status ON payin_intents (status);
CREATE INDEX IF NOT EXISTS ix_payins_created_at ON payin_intents (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payins_paid_tx_hash ON payin_intents (paid_tx_hash);
CREATE INDEX IF NOT EXISTS ix_payins_sweep_tx_hash ON payin_intents (sweep_tx_hash);

-- ============================================================
-- PAYMENT ROUTER INTENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_router_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  payin_intent_id UUID REFERENCES payin_intents(id) ON DELETE CASCADE,

  router_address TEXT NOT NULL,
  invoice_id_bytes32 TEXT NOT NULL,
  merchant_address TEXT,
  payer_address TEXT,

  token_address TEXT NOT NULL,
  amount_expected NUMERIC(36, 18) NOT NULL,
  amount_expected_atomic NUMERIC(78, 0) NOT NULL,

  invoice_paid_tx_hash TEXT,
  invoice_paid_block_number BIGINT,

  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_router_address CHECK (router_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT chk_router_invoice_id CHECK (invoice_id_bytes32 ~* '^0x[a-f0-9]{64}$'),
  CONSTRAINT chk_router_token CHECK (token_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT chk_router_merchant CHECK (
    merchant_address IS NULL OR merchant_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_router_payer CHECK (
    payer_address IS NULL OR payer_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_router_tx_hash CHECK (
    invoice_paid_tx_hash IS NULL OR invoice_paid_tx_hash ~* '^0x[a-f0-9]{64}$'
  )
);

DROP TRIGGER IF EXISTS trg_payment_router_intents_updated_at ON payment_router_intents;
CREATE TRIGGER trg_payment_router_intents_updated_at
BEFORE UPDATE ON payment_router_intents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ux_router_invoice
ON payment_router_intents (lower(router_address), lower(invoice_id_bytes32));

-- ============================================================
-- PAYOUTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,

  external_id TEXT NOT NULL,
  chain_flow_request_id TEXT,

  chain_flow_external_tx TEXT,
  chain_flow_retiro_pago BIGINT,
  chain_flow_transfer_block BIGINT,
  chain_flow_payment_processor BIGINT,
  chain_flow_currency_code BIGINT,

  status payout_status NOT NULL DEFAULT 'prepared',

  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,
  asset asset_symbol NOT NULL,
  token_address TEXT,
  decimals INTEGER NOT NULL DEFAULT 6,

  amount NUMERIC(36, 18) NOT NULL,
  amount_atomic NUMERIC(78, 0) NOT NULL,

  beneficiary_address TEXT NOT NULL,
  beneficiary_name TEXT,

  treasury_address TEXT,

  transaction_hash TEXT,
  block_number BIGINT,
  confirmations INTEGER,

  risk_level risk_level,
  risk_score INTEGER,

  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  prepared_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  broadcasted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_payout_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_payout_amount_atomic_positive CHECK (amount_atomic > 0),
  CONSTRAINT chk_payout_beneficiary_address CHECK (beneficiary_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT chk_payout_treasury_address CHECK (
    treasury_address IS NULL OR treasury_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_payout_tx_hash CHECK (
    transaction_hash IS NULL OR transaction_hash ~* '^0x[a-f0-9]{64}$'
  )
);

DROP TRIGGER IF EXISTS trg_payout_requests_updated_at ON payout_requests;
CREATE TRIGGER trg_payout_requests_updated_at
BEFORE UPDATE ON payout_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ux_payouts_institution_external
ON payout_requests (institution_id, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payouts_chain_flow_transfer_block
ON payout_requests (chain_flow_transfer_block)
WHERE chain_flow_transfer_block IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payouts_chain_flow_retiro_pago
ON payout_requests (chain_flow_retiro_pago)
WHERE chain_flow_retiro_pago IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_payouts_status ON payout_requests (status);
CREATE INDEX IF NOT EXISTS ix_payouts_created_at ON payout_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_payouts_tx_hash ON payout_requests (transaction_hash);

-- ============================================================
-- BLOCKCHAIN TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  type blockchain_tx_type NOT NULL,
  status blockchain_tx_status NOT NULL DEFAULT 'created',

  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,

  asset asset_symbol,
  token_address TEXT,

  from_address TEXT,
  to_address TEXT,

  amount NUMERIC(36, 18),
  amount_atomic NUMERIC(78, 0),

  tx_hash TEXT UNIQUE,
  nonce BIGINT,
  block_number BIGINT,
  confirmations INTEGER,
  gas_used NUMERIC(78, 0),
  effective_gas_price NUMERIC(78, 0),

  payin_intent_id UUID REFERENCES payin_intents(id) ON DELETE SET NULL,
  payout_request_id UUID REFERENCES payout_requests(id) ON DELETE SET NULL,
  settlement_id UUID,

  raw_receipt JSONB,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_btx_from_address CHECK (
    from_address IS NULL OR from_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_btx_to_address CHECK (
    to_address IS NULL OR to_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_btx_tx_hash CHECK (
    tx_hash IS NULL OR tx_hash ~* '^0x[a-f0-9]{64}$'
  )
);

DROP TRIGGER IF EXISTS trg_blockchain_transactions_updated_at ON blockchain_transactions;
CREATE TRIGGER trg_blockchain_transactions_updated_at
BEFORE UPDATE ON blockchain_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_btx_type_status ON blockchain_transactions (type, status);
CREATE INDEX IF NOT EXISTS ix_btx_payin ON blockchain_transactions (payin_intent_id);
CREATE INDEX IF NOT EXISTS ix_btx_payout ON blockchain_transactions (payout_request_id);
CREATE INDEX IF NOT EXISTS ix_btx_created_at ON blockchain_transactions (created_at DESC);

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,

  source_type settlement_source_type NOT NULL,
  source_id UUID,

  status settlement_status NOT NULL DEFAULT 'pending',

  asset asset_symbol NOT NULL,
  gross_amount NUMERIC(36, 18) NOT NULL,
  fee_bps INTEGER NOT NULL DEFAULT 0,
  fee_amount NUMERIC(36, 18) NOT NULL DEFAULT 0,
  net_amount NUMERIC(36, 18) NOT NULL,

  fiat_currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate NUMERIC(36, 18) NOT NULL DEFAULT 1,
  fiat_amount NUMERIC(36, 18) NOT NULL,

  payout_request_id UUID REFERENCES payout_requests(id) ON DELETE SET NULL,
  payin_intent_id UUID REFERENCES payin_intents(id) ON DELETE SET NULL,

  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_settlement_gross_positive CHECK (gross_amount > 0),
  CONSTRAINT chk_settlement_net_nonnegative CHECK (net_amount >= 0),
  CONSTRAINT chk_settlement_fiat_nonnegative CHECK (fiat_amount >= 0),
  CONSTRAINT chk_settlement_fee_bps CHECK (fee_bps >= 0 AND fee_bps <= 10000)
);

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON settlements;
CREATE TRIGGER trg_settlements_updated_at
BEFORE UPDATE ON settlements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_settlements_status ON settlements (status);
CREATE INDEX IF NOT EXISTS ix_settlements_source ON settlements (source_type, source_id);
CREATE INDEX IF NOT EXISTS ix_settlements_created_at ON settlements (created_at DESC);

ALTER TABLE payin_intents
DROP CONSTRAINT IF EXISTS fk_payin_settlement;

ALTER TABLE payin_intents
ADD CONSTRAINT fk_payin_settlement
FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE SET NULL;

ALTER TABLE blockchain_transactions
DROP CONSTRAINT IF EXISTS fk_btx_settlement;

ALTER TABLE blockchain_transactions
ADD CONSTRAINT fk_btx_settlement
FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE SET NULL;

-- ============================================================
-- RISK
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,

  subject_type TEXT NOT NULL,
  subject_id UUID,
  address TEXT,
  asset asset_symbol,
  amount NUMERIC(36, 18),

  provider TEXT NOT NULL DEFAULT 'mock',
  risk_level risk_level NOT NULL,
  risk_score INTEGER NOT NULL,
  action TEXT NOT NULL DEFAULT 'allow',
  reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  raw_response JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_risk_address CHECK (
    address IS NULL OR address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_risk_score CHECK (risk_score >= 0 AND risk_score <= 100)
);

CREATE INDEX IF NOT EXISTS ix_risk_subject ON risk_assessments (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_risk_address ON risk_assessments (lower(address));
CREATE INDEX IF NOT EXISTS ix_risk_created_at ON risk_assessments (created_at DESC);

-- ============================================================
-- AUDIT EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,

  actor_type audit_actor_type NOT NULL DEFAULT 'system',
  actor_id TEXT,

  subject_type TEXT NOT NULL,
  subject_id UUID,

  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  request_id TEXT,
  ip_address TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_subject ON audit_events (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_audit_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_created_at ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_correlation ON audit_events (correlation_id);

-- ============================================================
-- IDEMPOTENCY
-- ============================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,

  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  request_hash TEXT,
  response_body JSONB,
  status_code INTEGER,

  locked_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (institution_id, scope, key)
);

DROP TRIGGER IF EXISTS trg_idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER trg_idempotency_keys_updated_at
BEFORE UPDATE ON idempotency_keys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- WEBHOOKS
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,

  url TEXT NOT NULL,
  secret_hash TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  event_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER trg_webhook_endpoints_updated_at
BEFORE UPDATE ON webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  webhook_endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_webhook_deliveries_updated_at ON webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_updated_at
BEFORE UPDATE ON webhook_deliveries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS ix_webhook_deliveries_status ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS ix_webhook_deliveries_next_retry ON webhook_deliveries (next_retry_at);

-- ============================================================
-- eERC / PRIVATE SETTLEMENT FUTURE SUPPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS eerc_private_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,

  external_id TEXT,

  status TEXT NOT NULL DEFAULT 'planned',
  network avasettle_network NOT NULL,
  chain_id INTEGER NOT NULL,

  mode TEXT NOT NULL DEFAULT 'converter',
  public_asset asset_symbol NOT NULL DEFAULT 'USDC',

  eerc_contract_address TEXT,
  registrar_address TEXT,
  auditor_address TEXT,

  amount_expected NUMERIC(36, 18),
  encrypted_amount_commitment TEXT,

  related_payin_intent_id UUID REFERENCES payin_intents(id) ON DELETE SET NULL,
  related_settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_eerc_contract CHECK (
    eerc_contract_address IS NULL OR eerc_contract_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_eerc_registrar CHECK (
    registrar_address IS NULL OR registrar_address ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT chk_eerc_auditor CHECK (
    auditor_address IS NULL OR auditor_address ~* '^0x[a-f0-9]{40}$'
  )
);

DROP TRIGGER IF EXISTS trg_eerc_private_payment_intents_updated_at ON eerc_private_payment_intents;
CREATE TRIGGER trg_eerc_private_payment_intents_updated_at
BEFORE UPDATE ON eerc_private_payment_intents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- OPERATIONAL VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_avasettle_operations AS
SELECT
  'payin' AS operation_type,
  id,
  institution_id,
  merchant_id,
  external_id,
  status::TEXT AS status,
  asset::TEXT AS asset,
  amount_expected AS amount,
  paid_tx_hash AS tx_hash,
  created_at,
  updated_at
FROM payin_intents

UNION ALL

SELECT
  'payout' AS operation_type,
  id,
  institution_id,
  merchant_id,
  external_id,
  status::TEXT AS status,
  asset::TEXT AS asset,
  amount AS amount,
  transaction_hash AS tx_hash,
  created_at,
  updated_at
FROM payout_requests;

CREATE OR REPLACE VIEW v_avasettle_summary AS
SELECT
  (SELECT count(*) FROM payin_intents) AS total_payins,
  (SELECT count(*) FROM payin_intents WHERE status = 'confirmed') AS confirmed_payins,
  (SELECT count(*) FROM payout_requests) AS total_payouts,
  (SELECT count(*) FROM payout_requests WHERE status = 'confirmed') AS confirmed_payouts,
  (SELECT count(*) FROM settlements) AS total_settlements,
  (SELECT count(*) FROM settlements WHERE status = 'completed') AS completed_settlements;