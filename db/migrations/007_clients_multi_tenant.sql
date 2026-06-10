-- Multi-tenant clients + removal of unused hackathon-era schema.
--
-- 1. Drops the aspirational tables/views/enums from 001 that the runtime
--    never used (the app operates exclusively on the avasettle_* tables).
-- 2. Drops the simulated-settlement tables (mock functionality removed).
-- 3. Creates avasettle_clients and scopes operational tables per client.

-- ── 1. Unused schema from 001 ────────────────────────────────────────────────

DROP VIEW IF EXISTS v_avasettle_summary;
DROP VIEW IF EXISTS v_avasettle_operations;

DROP TABLE IF EXISTS eerc_private_payment_intents CASCADE;
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_endpoints CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS blockchain_transactions CASCADE;
DROP TABLE IF EXISTS payout_requests CASCADE;
DROP TABLE IF EXISTS payment_router_intents CASCADE;
DROP TABLE IF EXISTS payin_intents CASCADE;
DROP TABLE IF EXISTS derivation_counters CASCADE;
DROP TABLE IF EXISTS treasury_wallets CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS api_clients CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

DROP TYPE IF EXISTS audit_actor_type;
DROP TYPE IF EXISTS risk_level;
DROP TYPE IF EXISTS settlement_source_type;
DROP TYPE IF EXISTS settlement_status;
DROP TYPE IF EXISTS blockchain_tx_status;
DROP TYPE IF EXISTS blockchain_tx_type;
DROP TYPE IF EXISTS payout_status;
DROP TYPE IF EXISTS payin_status;
DROP TYPE IF EXISTS payin_mode;
DROP TYPE IF EXISTS asset_symbol;
DROP TYPE IF EXISTS avasettle_network;

-- ── 2. Simulated settlement tables (mock functionality removed) ──────────────

DROP TABLE IF EXISTS avasettle_private_settlements CASCADE;
DROP TABLE IF EXISTS avasettle_settlements CASCADE;

-- ── 3. Clients (multi-tenancy) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS avasettle_clients (
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_avasettle_clients_updated_at' AND c.relname = 'avasettle_clients'
  ) THEN
    CREATE TRIGGER trg_avasettle_clients_updated_at
    BEFORE UPDATE ON avasettle_clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- Scope operational tables per client. client_id stays nullable so pre-existing
-- rows survive; the application always sets it for new records.
ALTER TABLE avasettle_payins
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES avasettle_clients (id);
ALTER TABLE avasettle_payouts
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES avasettle_clients (id);
ALTER TABLE avasettle_audit_events
  ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE avasettle_webhook_deliveries
  ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE INDEX IF NOT EXISTS idx_avasettle_payins_client_id  ON avasettle_payins (client_id);
CREATE INDEX IF NOT EXISTS idx_avasettle_payouts_client_id ON avasettle_payouts (client_id);
CREATE INDEX IF NOT EXISTS idx_avasettle_audit_events_client_id ON avasettle_audit_events (client_id);
CREATE INDEX IF NOT EXISTS idx_avasettle_webhook_deliveries_client_id ON avasettle_webhook_deliveries (client_id);

-- externalId uniqueness is now per client, not global.
ALTER TABLE avasettle_payins  DROP CONSTRAINT IF EXISTS uq_avasettle_payins_external_id;
ALTER TABLE avasettle_payouts DROP CONSTRAINT IF EXISTS uq_avasettle_payouts_external_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_avasettle_payins_client_external
  ON avasettle_payins (client_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avasettle_payouts_client_external
  ON avasettle_payouts (client_id, external_id);
