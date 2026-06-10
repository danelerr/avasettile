-- Webhook delivery log: every fire() attempt is recorded here.
-- Allows querying recent failures and auditing delivery history.
CREATE TABLE IF NOT EXISTS avasettle_webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event        TEXT NOT NULL,
  url          TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  success      BOOLEAN NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 1,
  last_error   TEXT,
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avasettle_webhook_deliveries_created_at
  ON avasettle_webhook_deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avasettle_webhook_deliveries_success
  ON avasettle_webhook_deliveries (success);
