#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

DEMO_EXTERNAL_ID="${DEMO_EXTERNAL_ID:-EXT-0001}"
DEMO_AMOUNT="${DEMO_AMOUNT:-10}"
DEMO_MONEDA="${DEMO_MONEDA:-1}"
DEMO_TO_ADDRESS="${DEMO_TO_ADDRESS:-0x1111111111111111111111111111111111111111}"
DEMO_RETIRO_PAGO="${DEMO_RETIRO_PAGO:-12345}"
DEMO_TRANSFERENCIA_BLOQUE="${DEMO_TRANSFERENCIA_BLOQUE:-9001}"
DEMO_PROCESADOR_PAGOS="${DEMO_PROCESADOR_PAGOS:-3}"

body=$(cat <<JSON
{
  "tcTransaccionExterna": "${DEMO_EXTERNAL_ID}",
  "tnMonto": ${DEMO_AMOUNT},
  "tnMoneda": ${DEMO_MONEDA},
  "tcCuentaDestino": "${DEMO_TO_ADDRESS}",
  "tnRetiroPago": ${DEMO_RETIRO_PAGO},
  "tnTransferenciaBloque": ${DEMO_TRANSFERENCIA_BLOQUE},
  "tnProcesadorPagos": ${DEMO_PROCESADOR_PAGOS}
}
JSON
)

curl_json POST "/api/prepararretiro" "$body"
