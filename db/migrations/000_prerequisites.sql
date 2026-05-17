-- AvaSettle PostgreSQL prerequisites
-- Run this BEFORE `firebase deploy --only dataconnect`
-- These objects are not managed by Firebase Data Connect and must exist
-- in the Cloud SQL database before Data Connect can create tables
-- that reference them.

-- ============================================================
-- EXTENSIONS
-- ============================================================

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
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
