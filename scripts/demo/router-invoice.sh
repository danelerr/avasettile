#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

PAYIN_EXTERNAL_ID="${PAYIN_EXTERNAL_ID:-ROUTER-INVOICE-0001}"
PAYIN_AMOUNT="${PAYIN_AMOUNT:-10}"
PAYIN_ASSET="${PAYIN_ASSET:-USDC}"
PAYIN_EXPIRES_IN_MINUTES="${PAYIN_EXPIRES_IN_MINUTES:-30}"

body=$(cat <<JSON
{
  "externalId": "${PAYIN_EXTERNAL_ID}",
  "asset": "${PAYIN_ASSET}",
  "amount": "${PAYIN_AMOUNT}",
  "collectionMode": "payment-router",
  "expiresInMinutes": ${PAYIN_EXPIRES_IN_MINUTES},
  "metadata": {
    "source": "demo-script",
    "rail": "payment-router"
  }
}
JSON
)

curl_json POST "/v1/payins" "$body"
