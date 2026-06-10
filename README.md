# AvaSettle

B2B stablecoin payments infrastructure for PSPs, fintechs, and remittance companies in LATAM. Accepts and reconciles USDC/USDT pay-ins on Avalanche, sweeps funds into institutional treasury, and executes outbound ERC-20 payouts.

**Top 5 — Avalanche LATAM Institutional Hackathon · $300 prize**

---

## Production readiness

| Area | State |
|---|---|
| Pay-in / payout lifecycle | Ready |
| PostgreSQL normalized storage | Ready |
| Structured observability (W3C trace, HMAC webhooks) | Ready |
| Pagination on list endpoints | Ready |
| Webhook delivery log | Ready (PostgreSQL only) |
| Auto-sweep after confirmation | Ready (opt-in via `autoSweep`) |
| PaymentRouter smart contract | Scripts ready — not deployed yet |
| Treasury key management | Hot wallet — **not production-safe** |
| Rate limiting | In-memory — **does not scale multi-instance** |
| Fiat settlement | Simulated — no real fiat rail |
| Risk scoring | Mock thresholds — no real model |
| eERC private settlement | Experimental API only — no on-chain submission |

**Short answer:** Ready for institutional pilots on Fuji (testnet) or production Avalanche with a hot wallet accepted. Not ready for high-value mainnet unless treasury is moved to KMS/HSM and rate limiting to Redis.

---

## Architecture

```
Client / Chain Flow
        │
        ▼
  [AvaSettle API]  ──── PostgreSQL (normalized tables)
        │
        ├── PayinsService  ──── viem (getLogs, ERC-20)
        ├── PayoutsService ──── viem (sendTransaction)
        ├── ReconciliationService (setInterval or manual)
        ├── WebhookService (HMAC-SHA256, retry backoff)
        └── BlockchainService ── Avalanche C-Chain RPC
```

- **Storage:** JSON file (dev) or PostgreSQL via `pg` (prod). No ORM.
- **Key derivation:** BIP-44 HD wallet from `AVASETTLE_PAYIN_MNEMONIC`. Each pay-in gets a unique EVM address.
- **Sweep:** Treasury hot wallet top-ups derived addresses with AVAX, then sweeps ERC-20 to treasury.
- **Smart contract:** Optional `PaymentRouter.sol` (Foundry) — payer approves USDC, calls `payInvoice`, funds go directly to treasury without per-address sweep.

---

## Quick start

```bash
cd avasettle
pnpm install
cp .env.example .env   # fill in secrets
pnpm start:dev
```

API available at `http://localhost:3001`.  
Swagger UI at `http://localhost:3001/docs`.

---

## Configuration

Secrets go in `.env`. Everything else goes in `config/avasettle.json` (see `config/avasettle.example.json`).

### Secrets (`.env` only — never commit)

| Variable | Required | Description |
|---|---|---|
| `AVASETTLE_API_KEY` | Yes | Shared B2B secret. Generate with `openssl rand -hex 32`. |
| `AVASETTLE_TREASURY_PRIVATE_KEY` | Yes | Hot wallet private key for payouts and sweep top-ups. |
| `AVASETTLE_PAYIN_MNEMONIC` | Yes | BIP-39 mnemonic for deriving pay-in deposit addresses. |
| `AVASETTLE_DATABASE_URL` | Postgres only | `postgresql://user:pass@host:5432/avasettle` |
| `AVASETTLE_WEBHOOK_SECRET` | Recommended | HMAC-SHA256 key for `x-avasettle-signature` header. |

### Operational config (`config/avasettle.json`)

```json
{
  "network": "avalanche-fuji",
  "port": 3001,
  "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
  "storage": {
    "driver": "postgres",
    "database": { "ssl": false, "maxConnections": 5, "autoMigrate": true }
  },
  "payin": {
    "lookbackBlocks": 50000,
    "defaultExpirationMinutes": 30
  },
  "assets": {
    "enabled": ["USDC"],
    "USDC": { "address": "0x5425890298aed601595a70AB815c96711a31Bc65", "decimals": 6, "maxPayoutAmount": "1000" }
  },
  "blockchain": { "minConfirmations": 2, "waitForReceipt": false },
  "settlement": { "fiatCurrency": "USD", "fiatRate": 1 },
  "webhook": { "url": "https://your-endpoint.com/webhook", "retryAttempts": 3 },
  "autoReconcileIntervalSeconds": 30,
  "autoSweep": false
}
```

Env vars always override config file values.

---

## Commands

```bash
pnpm start:dev          # hot-reload dev server
pnpm build              # compile TypeScript
pnpm start:prod         # run compiled build
pnpm test               # unit tests
pnpm test:e2e           # integration tests
pnpm db:migrate         # run pending SQL migrations
pnpm db:check           # check migration status
pnpm contracts:build    # compile PaymentRouter.sol with Foundry
```

---

## Database migrations

Migrations run automatically on startup when `autoMigrate: true`. For production-like deployments run them explicitly:

```bash
AVASETTLE_DATABASE_URL=postgresql://... pnpm db:migrate
```

| Migration | Purpose |
|---|---|
| `001_init_avasettle.sql` | Full normalized schema |
| `002_runtime_state.sql` | No-op (legacy) |
| `003_normalized_tables.sql` | Pay-ins, payouts, audit events, settlements, idempotency |
| `004_settlement_extended.sql` | Settlement columns + private settlements table |
| `005_drop_runtime_state.sql` | Drops legacy blob table |
| `006_webhook_deliveries.sql` | Webhook delivery log |

---

## Smart contracts

`PaymentRouter.sol` is an optional Avalanche-native invoice rail. Deploy with Foundry:

```bash
cd avasettle
# Fuji
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify

# Mainnet
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://api.avax.network/ext/bc/C/rpc \
  --broadcast --verify
```

After deployment, set `AVASETTLE_PAYMENT_ROUTER_ADDRESS` to the deployed address.

Contract features:
- `payInvoice(invoiceId, token, amount, metadata)` — ERC-20 transfer directly to treasury
- `emergencyWithdraw(token, to, amount)` — owner-only recovery
- `minAmount` per token — prevents dust attacks
- `invoicePaid[invoiceId]` guard — prevents double payment

---

## Webhooks

AvaSettle fires webhooks to `AVASETTLE_WEBHOOK_URL` for lifecycle events. All payloads are signed with `x-avasettle-signature: sha256=<hmac-hex>`.

Verify in your receiver:
```javascript
const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
const valid = sig === req.headers['x-avasettle-signature'].slice(7);
```

| Event | Fires when |
|---|---|
| `payin.detected` | First transfer seen at deposit address (not yet confirmed) |
| `payin.confirmed` | Pay-in reaches required confirmations (or manually accepted) |
| `payout.confirmed` | Payout transaction confirmed on-chain |

Failed deliveries are retried with backoff (1s → 5s → 30s). All delivery attempts logged to `avasettle_webhook_deliveries`.

---

## Auto-sweep

Set `autoSweep: true` in config (or `AVASETTLE_AUTO_SWEEP=true`) to automatically top up and sweep derived-address pay-ins when they confirm. Fires in the background — never blocks reconciliation. PaymentRouter pay-ins are excluded (they settle directly to treasury).

---

## Deploy to Cloud Run

```bash
# Store secrets
printf '%s' "$AVASETTLE_API_KEY"              | gcloud secrets create avasettle-api-key --data-file=-
printf '%s' "$AVASETTLE_TREASURY_PRIVATE_KEY" | gcloud secrets create avasettle-treasury-private-key --data-file=-
printf '%s' "$AVASETTLE_PAYIN_MNEMONIC"       | gcloud secrets create avasettle-payin-mnemonic --data-file=-
printf '%s' "$AVASETTLE_DATABASE_URL"         | gcloud secrets create avasettle-database-url --data-file=-
printf '%s' "$AVASETTLE_WEBHOOK_SECRET"       | gcloud secrets create avasettle-webhook-secret --data-file=-

# Deploy
gcloud run deploy avasettle \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-secrets \
    AVASETTLE_API_KEY=avasettle-api-key:latest,\
    AVASETTLE_TREASURY_PRIVATE_KEY=avasettle-treasury-private-key:latest,\
    AVASETTLE_PAYIN_MNEMONIC=avasettle-payin-mnemonic:latest,\
    AVASETTLE_DATABASE_URL=avasettle-database-url:latest,\
    AVASETTLE_WEBHOOK_SECRET=avasettle-webhook-secret:latest
```

Cloud Run injects `PORT` automatically. Do not hardcode it.

---

## API reference

See [`docs/api.md`](docs/api.md) for the full endpoint reference with request/response examples.

Swagger UI (when server is running): `http://localhost:3001/docs`

---

## Operational notes

- Treasury hot wallet must hold AVAX for payout gas and for topping up derived pay-in addresses before sweeping.
- `AVASETTLE_PAYIN_MNEMONIC` controls real EVM addresses. Treat it like a production private key.
- Set explicit token contract addresses per network — never rely on defaults.
- Use `pnpm db:migrate` for production migrations, not `autoMigrate`.
- Rotate `AVASETTLE_API_KEY` before sharing with new integration partners.
- `GET /health/readiness` tells you if treasury key, mnemonic, and token addresses are configured.

---

## References

- [Avalanche Fuji network parameters](https://build.avax.network/docs/quick-start/networks/fuji-testnet)
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [Cloud Run source deployment](https://cloud.google.com/run/docs/deploying-source-code)
