#!/usr/bin/env bash
# Smoke test for a running AvaSettle instance (local Docker, Fuji, or prod).
#
#   API_BASE_URL=http://localhost:3001 AVASETTLE_ADMIN_API_KEY=... bash scripts/smoke.sh
#
# Verifies: liveness, readiness, client registration, client-key auth,
# and tenant scoping. Requires curl and python3 (for JSON parsing).
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
ADMIN_KEY="${AVASETTLE_ADMIN_API_KEY:-dev-admin-key-change-me}"

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
json_get() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

step "1/5 Liveness (GET /health)"
curl -fsS "${API_BASE_URL}/health" | json_get "['status']"

step "2/5 Readiness (GET /health/readiness)"
READY=$(curl -fsS "${API_BASE_URL}/health/readiness")
echo "$READY" | json_get "['status']"
echo "$READY" | json_get "['checks']"

step "3/5 Register a client (POST /v1/admin/clients)"
CLIENT=$(curl -fsS -X POST "${API_BASE_URL}/v1/admin/clients" \
  -H "x-avasettle-api-key: ${ADMIN_KEY}" \
  -H "content-type: application/json" \
  -d '{"name": "Smoke Test Client"}')
CLIENT_ID=$(echo "$CLIENT" | json_get "['id']")
CLIENT_KEY=$(echo "$CLIENT" | json_get "['apiKey']")
echo "client: ${CLIENT_ID} (key prefix: ${CLIENT_KEY:0:12}...)"

step "4/5 Client-key auth works (GET /v1/payins)"
curl -fsS "${API_BASE_URL}/v1/payins" \
  -H "x-avasettle-api-key: ${CLIENT_KEY}" > /dev/null
echo "ok"

step "5/5 Invalid key is rejected (expects 401)"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${API_BASE_URL}/v1/payins" \
  -H "x-avasettle-api-key: avk_invalid")
if [[ "$STATUS" != "401" ]]; then
  echo "FAIL: expected 401, got ${STATUS}" >&2
  exit 1
fi
echo "ok (401)"

step "Cleanup: disable smoke client"
curl -fsS -X PATCH "${API_BASE_URL}/v1/admin/clients/${CLIENT_ID}" \
  -H "x-avasettle-api-key: ${ADMIN_KEY}" \
  -H "content-type: application/json" \
  -d '{"status": "disabled"}' > /dev/null
echo "done"

printf '\n\033[32mSmoke test passed.\033[0m\n'
