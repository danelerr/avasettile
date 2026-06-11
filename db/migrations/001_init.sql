-- AvaSettle — initial schema (PostgreSQL)
-- Multi-tenant stablecoin pay-in/payout infrastructure on Avalanche.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-updated timestamps, reused by every table trigger below.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Clients (multi-tenancy) ──────────────────────────────────────────────────
-- One row per institution. Only the SHA-256 hash of the API key is stored.

CREATE TABLE avasettle_clients (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  api_key_hash   TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  webhook_url    TEXT,
  webhook_secret TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_avasettle_clients_updated_at
BEFORE UPDATE ON avasettle_clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Pay-ins ──────────────────────────────────────────────────────────────────

CREATE TABLE avasettle_payins (
  id                      UUID PRIMARY KEY,
  client_id               UUID REFERENCES avasettle_clients (id),
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
  last_scanned_block      TEXT,
  expires_at              TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,
  acceptance_note         TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  transfers               JSONB NOT NULL DEFAULT '[]',
  detected_at             TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- externalId is unique per client, enabling race-safe idempotent creation
-- via INSERT ... ON CONFLICT (client_id, external_id).
CREATE UNIQUE INDEX uq_avasettle_payins_client_external
  ON avasettle_payins (client_id, external_id);
CREATE INDEX idx_avasettle_payins_client_id       ON avasettle_payins (client_id);
CREATE INDEX idx_avasettle_payins_status          ON avasettle_payins (status);
CREATE INDEX idx_avasettle_payins_created_at      ON avasettle_payins (created_at);
CREATE INDEX idx_avasettle_payins_deposit_address ON avasettle_payins (deposit_address);

CREATE TRIGGER trg_avasettle_payins_updated_at
BEFORE UPDATE ON avasettle_payins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Payouts ──────────────────────────────────────────────────────────────────

CREATE TABLE avasettle_payouts (
  id                    UUID PRIMARY KEY,
  client_id             UUID REFERENCES avasettle_clients (id),
  external_id           TEXT NOT NULL,
  chain_flow_request_id TEXT,
  status                TEXT NOT NULL,
  network               TEXT NOT NULL,
  chain_id              INTEGER NOT NULL,
  asset                 TEXT NOT NULL,
  token_address         TEXT NOT NULL,
  amount                TEXT NOT NULL,
  amount_atomic         TEXT NOT NULL,
  beneficiary_address   TEXT NOT NULL,
  beneficiary_name      TEXT,
  treasury_address      TEXT,
  transaction_hash      TEXT,
  failure_reason        TEXT,
  memo                  TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  authorized_at         TIMESTAMPTZ,
  broadcasted_at        TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_avasettle_payouts_client_external
  ON avasettle_payouts (client_id, external_id);
CREATE INDEX idx_avasettle_payouts_client_id   ON avasettle_payouts (client_id);
CREATE INDEX idx_avasettle_payouts_status      ON avasettle_payouts (status);
CREATE INDEX idx_avasettle_payouts_created_at  ON avasettle_payouts (created_at);
CREATE INDEX idx_avasettle_payouts_beneficiary ON avasettle_payouts (beneficiary_address);

CREATE TRIGGER trg_avasettle_payouts_updated_at
BEFORE UPDATE ON avasettle_payouts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Audit events ─────────────────────────────────────────────────────────────

CREATE TABLE avasettle_audit_events (
  id         UUID PRIMARY KEY,
  client_id  UUID,
  type       TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor      JSONB NOT NULL DEFAULT '{}',
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avasettle_audit_events_client_id  ON avasettle_audit_events (client_id);
CREATE INDEX idx_avasettle_audit_events_subject_id ON avasettle_audit_events (subject_id);
CREATE INDEX idx_avasettle_audit_events_type       ON avasettle_audit_events (type);
CREATE INDEX idx_avasettle_audit_events_created_at ON avasettle_audit_events (created_at);

-- ── Derivation counter ───────────────────────────────────────────────────────
-- Claimed with UPDATE ... RETURNING so concurrent instances never derive the
-- same pay-in deposit address.

CREATE TABLE avasettle_counters (
  key        TEXT PRIMARY KEY,
  value      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO avasettle_counters (key, value)
VALUES ('payin_address_index', 0);

-- ── Idempotency keys ─────────────────────────────────────────────────────────
-- Keys are namespaced per client by the application ("<clientId>:<key>").

CREATE TABLE avasettle_idempotency_keys (
  key        TEXT PRIMARY KEY,
  record_id  UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Webhook outbox ───────────────────────────────────────────────────────────
-- Durable event queue: services enqueue here in the request path; a background
-- dispatcher delivers with backoff. Rows are claimed with FOR UPDATE SKIP
-- LOCKED so multiple instances never deliver the same event twice.

CREATE TABLE avasettle_webhook_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | delivering | delivered | failed | skipped
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avasettle_webhook_outbox_due
  ON avasettle_webhook_outbox (status, next_attempt_at);

CREATE TRIGGER trg_avasettle_webhook_outbox_updated_at
BEFORE UPDATE ON avasettle_webhook_outbox
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Webhook delivery log ─────────────────────────────────────────────────────

CREATE TABLE avasettle_webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID,
  event        TEXT NOT NULL,
  url          TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  success      BOOLEAN NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 1,
  last_error   TEXT,
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avasettle_webhook_deliveries_client_id  ON avasettle_webhook_deliveries (client_id);
CREATE INDEX idx_avasettle_webhook_deliveries_created_at ON avasettle_webhook_deliveries (created_at DESC);
CREATE INDEX idx_avasettle_webhook_deliveries_success    ON avasettle_webhook_deliveries (success);
