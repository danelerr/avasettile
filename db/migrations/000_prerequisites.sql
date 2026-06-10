-- AvaSettle PostgreSQL prerequisites

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-updated timestamps, reused by every avasettle_* table trigger.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
