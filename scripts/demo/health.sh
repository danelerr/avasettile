#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:${PORT:-3001}}"

curl -sS "${API_BASE_URL}/health/readiness"
printf "\n"
