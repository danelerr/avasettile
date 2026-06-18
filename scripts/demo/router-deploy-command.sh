#!/usr/bin/env bash
set -euo pipefail

AVASETTLE_USDC_ADDRESS="${AVASETTLE_USDC_ADDRESS:-0x5425890298aed601595a70AB815c96711a31Bc65}"

if [[ -z "${AVASETTLE_TREASURY_ADDRESS:-}" ]]; then
  echo "Set AVASETTLE_TREASURY_ADDRESS to the treasury EVM address." >&2
  exit 1
fi

if [[ -z "${PAYMENT_ROUTER_OWNER:-}" ]]; then
  echo "Set PAYMENT_ROUTER_OWNER to the owner/admin EVM address." >&2
  exit 1
fi

cat <<EOF
cd contracts
forge create src/PaymentRouter.sol:PaymentRouter \\
  --rpc-url "\$AVASETTLE_RPC_URL" \\
  --private-key "\$DEPLOYER_PRIVATE_KEY" \\
  --constructor-args "$PAYMENT_ROUTER_OWNER" "$AVASETTLE_TREASURY_ADDRESS"

After deployment:
1. Set AVASETTLE_PAYMENT_ROUTER_ADDRESS to the deployed address.
2. Enable Fuji USDC (signature is setTokenSupported(address,bool,uint256); the
   third arg is the per-token minimum atomic amount — 1000000 = 1.00 USDC):
   cast send "\$AVASETTLE_PAYMENT_ROUTER_ADDRESS" "setTokenSupported(address,bool,uint256)" "$AVASETTLE_USDC_ADDRESS" true 1000000 --rpc-url "\$AVASETTLE_RPC_URL" --private-key "\$DEPLOYER_PRIVATE_KEY"
EOF
