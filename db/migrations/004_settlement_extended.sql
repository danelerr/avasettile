-- Adds missing columns to avasettle_settlements and creates private settlements table.
-- Run after 003_normalized_tables.sql.

ALTER TABLE avasettle_settlements
  ADD COLUMN IF NOT EXISTS source_type    TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rail           TEXT NOT NULL DEFAULT 'simulated-fiat-rail',
  ADD COLUMN IF NOT EXISTS reference      TEXT,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Private settlements (experimental eERC / metadata-redaction mode)
CREATE TABLE IF NOT EXISTS avasettle_private_settlements (
  id                       UUID PRIMARY KEY,
  external_id              TEXT NOT NULL UNIQUE,
  mode                     TEXT NOT NULL,
  status                   TEXT NOT NULL,
  subject_type             TEXT NOT NULL,
  subject_id               TEXT,
  asset                    TEXT NOT NULL,
  public_amount            TEXT,
  amount_commitment        TEXT NOT NULL,
  counterparty_commitment  TEXT,
  metadata_hash            TEXT NOT NULL,
  eerc_contract_address    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avasettle_private_settlements_status
  ON avasettle_private_settlements (status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_avasettle_private_settlements_updated_at'
      AND c.relname = 'avasettle_private_settlements'
  ) THEN
    CREATE TRIGGER trg_avasettle_private_settlements_updated_at
    BEFORE UPDATE ON avasettle_private_settlements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
