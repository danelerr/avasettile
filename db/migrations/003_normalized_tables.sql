-- AvaSettle normalized tables
-- Replaces the single JSONB blob with proper relational tables.
-- The runtime JSONB blob (002_runtime_state.sql) remains the active store
-- until AVASETTLE_STORAGE_DRIVER is migrated to use these tables.
-- These tables are indexed and ready for production reporting and analytics.

-- Pay-ins
CREATE TABLE IF NOT EXISTS avasettle_payins (
  id                      UUID PRIMARY KEY,
  external_id             TEXT NOT NULL,
  chain_flow_request_id   TEXT,
  status                  TEXT NOT NULL,
  network                 TEXT NOT NULL,
  chain_id                INTEGER NOT NULL,
  asset                   TEXT NOT NULL,
  token_address           TEXT NOT NULL,
  collection_mode         TEXT NOT NULL DEFAULT 'derived-address',
  deposit_address         TEXT NOT NULL,
  derivation_index        INTEGER NOT NULL DEFAULT -1,
  router_address          TEXT,
  router_invoice_id       TEXT,
  expected_amount         TEXT NOT NULL,
  expected_amount_atomic  TEXT NOT NULL,
  received_amount         TEXT NOT NULL DEFAULT '0',
  received_amount_atomic  TEXT NOT NULL DEFAULT '0',
  sweep_status            TEXT NOT NULL DEFAULT 'pending',
  sweep_tx_hash           TEXT,
  swept_amount            TEXT NOT NULL DEFAULT '0',
  swept_amount_atomic     TEXT NOT NULL DEFAULT '0',
  swept_at                TIMESTAMPTZ,
  sweep_failure_reason    TEXT,
  start_block             TEXT NOT NULL,
  expires_at              TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,
  acceptance_note         TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  transfers               JSONB NOT NULL DEFAULT '[]',
  detected_at             TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_avasettle_payins_external_id UNIQUE (external_id)
);

CREATE INDEX IF NOT EXISTS idx_avasettle_payins_status      ON avasettle_payins (status);
CREATE INDEX IF NOT EXISTS idx_avasettle_payins_created_at  ON avasettle_payins (created_at);
CREATE INDEX IF NOT EXISTS idx_avasettle_payins_deposit_address ON avasettle_payins (deposit_address);

-- Pay-outs
CREATE TABLE IF NOT EXISTS avasettle_payouts (
  id                  UUID PRIMARY KEY,
  external_id         TEXT NOT NULL,
  chain_flow_request_id TEXT,
  status              TEXT NOT NULL,
  network             TEXT NOT NULL,
  chain_id            INTEGER NOT NULL,
  asset               TEXT NOT NULL,
  token_address       TEXT NOT NULL,
  amount              TEXT NOT NULL,
  amount_atomic       TEXT NOT NULL,
  beneficiary_address TEXT NOT NULL,
  beneficiary_name    TEXT,
  treasury_address    TEXT,
  transaction_hash    TEXT,
  failure_reason      TEXT,
  memo                TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  authorized_at       TIMESTAMPTZ,
  broadcasted_at      TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_avasettle_payouts_external_id UNIQUE (external_id)
);

CREATE INDEX IF NOT EXISTS idx_avasettle_payouts_status      ON avasettle_payouts (status);
CREATE INDEX IF NOT EXISTS idx_avasettle_payouts_created_at  ON avasettle_payouts (created_at);
CREATE INDEX IF NOT EXISTS idx_avasettle_payouts_beneficiary ON avasettle_payouts (beneficiary_address);

-- Audit events
CREATE TABLE IF NOT EXISTS avasettle_audit_events (
  id         UUID PRIMARY KEY,
  type       TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor      JSONB NOT NULL DEFAULT '{}',
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avasettle_audit_events_subject_id ON avasettle_audit_events (subject_id);
CREATE INDEX IF NOT EXISTS idx_avasettle_audit_events_type       ON avasettle_audit_events (type);
CREATE INDEX IF NOT EXISTS idx_avasettle_audit_events_created_at ON avasettle_audit_events (created_at);

-- Settlements
CREATE TABLE IF NOT EXISTS avasettle_settlements (
  id             UUID PRIMARY KEY,
  payin_id       UUID REFERENCES avasettle_payins (id) ON DELETE SET NULL,
  status         TEXT NOT NULL,
  asset          TEXT NOT NULL,
  crypto_amount  TEXT NOT NULL,
  fiat_currency  TEXT NOT NULL,
  fiat_amount    TEXT NOT NULL,
  fx_rate        TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avasettle_settlements_status     ON avasettle_settlements (status);
CREATE INDEX IF NOT EXISTS idx_avasettle_settlements_created_at ON avasettle_settlements (created_at);

-- Derivation counter (enables multi-instance safety via SELECT ... FOR UPDATE)
CREATE TABLE IF NOT EXISTS avasettle_counters (
  key        TEXT PRIMARY KEY,
  value      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO avasettle_counters (key, value)
VALUES ('payin_address_index', 0)
ON CONFLICT (key) DO NOTHING;

-- Idempotency key registry
CREATE TABLE IF NOT EXISTS avasettle_idempotency_keys (
  key        TEXT PRIMARY KEY,
  record_id  UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-updated timestamps (reuses set_updated_at() from 000_prerequisites.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_avasettle_payins_updated_at' AND c.relname = 'avasettle_payins'
  ) THEN
    CREATE TRIGGER trg_avasettle_payins_updated_at
    BEFORE UPDATE ON avasettle_payins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_avasettle_payouts_updated_at' AND c.relname = 'avasettle_payouts'
  ) THEN
    CREATE TRIGGER trg_avasettle_payouts_updated_at
    BEFORE UPDATE ON avasettle_payouts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_avasettle_settlements_updated_at' AND c.relname = 'avasettle_settlements'
  ) THEN
    CREATE TRIGGER trg_avasettle_settlements_updated_at
    BEFORE UPDATE ON avasettle_settlements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
