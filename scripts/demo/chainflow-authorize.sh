#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DEMO_EXTERNAL_ID="${DEMO_EXTERNAL_ID:-EXT-0001}"

body=$(cat <<JSON
{
  "tcTransaccionExterna": "${DEMO_EXTERNAL_ID}"
}
JSON
)

curl_json POST "/api/autorizarretiro" "$body"
