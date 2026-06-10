-- Remove the legacy JSONB blob table now that normalized tables are the storage layer.
DROP TABLE IF EXISTS avasettle_runtime_state CASCADE;
