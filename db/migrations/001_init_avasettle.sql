-- Deprecated: the original hackathon-era schema (institutions, merchants,
-- payin_intents, ...) was never used by the runtime and is dropped in
-- 007_clients_multi_tenant.sql. This migration is a no-op so existing
-- migration-runner history is preserved.
SELECT 1;
