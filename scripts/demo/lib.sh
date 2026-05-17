#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:${PORT:-3001}}"
AVASETTLE_API_KEY="${AVASETTLE_API_KEY:-pon-una-key-generada}"

curl_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "${API_BASE_URL}${path}" \
      -H "content-type: application/json" \
      -H "x-avasettle-api-key: ${AVASETTLE_API_KEY}" \
      -H "x-institution-id: chain-flow" \
      -H "x-correlation-id: ${DEMO_EXTERNAL_ID:-demo-local}" \
      -H "idempotency-key: ${DEMO_EXTERNAL_ID:-demo-local}" \
      --data "$body"
  else
    curl -sS -X "$method" "${API_BASE_URL}${path}" \
      -H "x-avasettle-api-key: ${AVASETTLE_API_KEY}" \
      -H "x-institution-id: chain-flow" \
      -H "x-correlation-id: ${DEMO_EXTERNAL_ID:-demo-local}" \
      -H "idempotency-key: ${DEMO_EXTERNAL_ID:-demo-local}"
  fi

  printf "\n"
}
