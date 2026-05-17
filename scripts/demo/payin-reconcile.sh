#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

if [[ -z "${PAYIN_ID:-}" ]]; then
  echo "Set PAYIN_ID with the id returned by pnpm demo:payin:create." >&2
  exit 1
fi

curl_json POST "/v1/payins/${PAYIN_ID}/reconcile"
