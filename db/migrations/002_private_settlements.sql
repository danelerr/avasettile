-- Private settlements: hash-commitment records for the PrivateSettlementRegistry.
-- Only the commitment goes on-chain; the preimage (amount, counterparty, nonce)
-- is kept here so the institution (registrar) — or an auditor it discloses to —
-- can later prove what a record represents via the contract's reveal flow.

CREATE TABLE avasettle_private_settlements (
  id                       UUID PRIMARY KEY,
  client_id                UUID REFERENCES avasettle_clients (id),
  external_id              TEXT NOT NULL,
  -- On-chain identifiers (bytes32 hex).
  settlement_id            TEXT NOT NULL,
  settlement_ref           TEXT NOT NULL,
  commitment               TEXT NOT NULL,
  -- Preimage (kept off the public ledger; required to reveal for audit).
  asset                    TEXT NOT NULL,
  token_address            TEXT NOT NULL,
  amount                   TEXT NOT NULL,
  amount_atomic            TEXT NOT NULL,
  counterparty             TEXT NOT NULL,
  nonce                    TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'recorded',
  transaction_hash         TEXT,
  reveal_transaction_hash  TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent, race-safe creation per client (INSERT ... ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX uq_avasettle_private_settlements_client_external
  ON avasettle_private_settlements (client_id, external_id);
CREATE INDEX idx_avasettle_private_settlements_client
  ON avasettle_private_settlements (client_id);
