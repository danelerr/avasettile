-- AvaSettle runtime state
-- Keeps the current NestJS ledger durable while normalized tables are adopted
-- incrementally by the API services.

CREATE TABLE IF NOT EXISTS avasettle_runtime_state (
  key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_avasettle_runtime_state_updated_at
ON avasettle_runtime_state;

CREATE TRIGGER trg_avasettle_runtime_state_updated_at
BEFORE UPDATE ON avasettle_runtime_state
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
