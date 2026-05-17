#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

PRIVACY_EXTERNAL_ID="${PRIVACY_EXTERNAL_ID:-PRIVACY-DEMO-0001}"
PRIVACY_MODE="${PRIVACY_MODE:-metadata-redaction}"
PRIVACY_SUBJECT_TYPE="${PRIVACY_SUBJECT_TYPE:-payin}"
PRIVACY_SUBJECT_ID="${PRIVACY_SUBJECT_ID:-manual-demo}"
PRIVACY_ASSET="${PRIVACY_ASSET:-USDC}"
PRIVACY_AMOUNT="${PRIVACY_AMOUNT:-10}"

body=$(cat <<JSON
{
  "externalId": "${PRIVACY_EXTERNAL_ID}",
  "mode": "${PRIVACY_MODE}",
  "subjectType": "${PRIVACY_SUBJECT_TYPE}",
  "subjectId": "${PRIVACY_SUBJECT_ID}",
  "asset": "${PRIVACY_ASSET}",
  "amount": "${PRIVACY_AMOUNT}",
  "metadata": {
    "source": "demo-script"
  }
}
JSON
)

curl_json POST "/v1/privacy/settlements" "$body"
