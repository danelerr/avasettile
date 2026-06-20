# AvaSettle

Multi-tenant B2B stablecoin payments infrastructure for PSPs, fintechs, and remittance companies in LATAM. Accepts and reconciles USDC/USDT pay-ins on Avalanche, sweeps funds into institutional treasury, and executes outbound ERC-20 payouts.

**Top 5 — Avalanche LATAM Institutional Hackathon · $300 prize**

---

## Production readiness

| Area | State |
|---|---|
| Pay-in / payout lifecycle | Ready |
| Multi-tenant clients (per-client API keys, data scoping, webhooks) | Ready |
| PostgreSQL persistence (direct, no in-memory state) | Ready |
| Structured observability (W3C trace, HMAC webhooks) | Ready |
| Pagination on list endpoints | Ready |
| Webhook delivery log | Ready |
| Auto-sweep after confirmation | Ready (opt-in via `autoSweep`) |
| CI (typecheck, lint, tests, build, migration check) | Ready |
| PaymentRouter smart contract | **Deployed + verified on C-Chain mainnet** — [`0x91Bf4c06…149c2`](https://snowtrace.io/address/0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2) |
| Treasury key management | Hot wallet — **not production-safe for high value** |
| Rate limiting | In-memory per instance — move to Redis for multi-instance |

**Short answer:** Ready for institutional pilots on Fuji (testnet) or production Avalanche with a hot wallet accepted. For high-value mainnet move the treasury key to KMS/HSM and rate limiting to Redis.

---

## Architecture

```
Clients (per-tenant API keys)          Platform operator (admin key)
        │                                       │
        ▼                                       ▼
  [AvaSettle API]  ───────────────  /v1/admin/clients
        │
        ├── ClientsService   ──── PostgreSQL (avasettle_clients)
        ├── PayinsService    ──── viem (getLogs, ERC-20)
        ├── PayoutsService   ──── viem (sendTransaction)
        ├── ReconciliationService (setInterval or manual, admin)
        ├── WebhookService   ──── per-client URL + HMAC secret
        └── BlockchainService ─── Avalanche C-Chain RPC
```

- **Tenancy:** every client (institution) is registered via the admin API and gets its own API key (only the SHA-256 hash is stored). All pay-ins, payouts, audit events, and webhook deliveries are scoped by `client_id`.
- **Storage:** PostgreSQL via `pg`, no ORM, no in-memory state. The HD derivation counter is claimed atomically in SQL, so multiple instances never derive the same address.
- **Key derivation:** BIP-44 HD wallet from `AVASETTLE_PAYIN_MNEMONIC`. Each pay-in gets a unique EVM address.
- **Sweep:** Treasury hot wallet top-ups derived addresses with AVAX, then sweeps ERC-20 to treasury.
- **Smart contract:** Optional `PaymentRouter.sol` (Foundry) — payer approves USDC, calls `payInvoice`, funds go directly to treasury without per-address sweep.

---

## Quick start

### Option A — Docker Compose (recommended, no local Node/Postgres needed)

```bash
cd avasettle
docker compose up --build
```

This starts PostgreSQL 16 and the API (migrations run automatically) on
`http://localhost:3001`. Then verify the stack end to end:

```bash
API_BASE_URL=http://localhost:3001 AVASETTLE_ADMIN_API_KEY=dev-admin-key-change-me \
  bash scripts/smoke.sh
```

To use real Fuji pay-ins/payouts from Docker, put `AVASETTLE_TREASURY_PRIVATE_KEY`
and `AVASETTLE_PAYIN_MNEMONIC` in a `.env` file next to `docker-compose.yml`.

### Option B — Node locally, Postgres in Docker

```bash
docker compose up -d postgres
pnpm install
cp .env.example .env   # DATABASE_URL=postgres://avasettle:avasettle@localhost:5432/avasettle
pnpm start:dev
```

API available at `http://localhost:3001`.
Swagger UI at `http://localhost:3001/docs`.

### Register your first client

```bash
curl -X POST http://localhost:3001/v1/admin/clients \
  -H "x-avasettle-api-key: $AVASETTLE_ADMIN_API_KEY" \
  -H "content-type: application/json" \
  -d '{"name": "Fintech LATAM SA", "webhookUrl": "https://example.com/webhooks", "webhookSecret": "hook-secret"}'
```

The response contains the client `apiKey` **once** — store it securely. The client then calls every `/v1/*` business endpoint with `x-avasettle-api-key: <client key>`.

---

## Configuration

Secrets go in `.env`. Everything else goes in `config/avasettle.json` (see `config/avasettle.example.json`).

### Secrets (`.env` only — never commit)

| Variable | Required | Description |
|---|---|---|
| `AVASETTLE_ADMIN_API_KEY` | Yes | Platform-operator key for client management. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/avasettle` |
| `AVASETTLE_TREASURY_PRIVATE_KEY` | Yes | Hot wallet private key for payouts and sweep top-ups. |
| `AVASETTLE_PAYIN_MNEMONIC` | Yes | BIP-39 mnemonic for deriving pay-in deposit addresses. |

Webhook URLs and signing secrets are configured **per client** via the admin API, not via env vars.

### Operational config (`config/avasettle.json`)

```json
{
  "network": "avalanche-fuji",
  "port": 3001,
  "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc",
  "database": { "ssl": false, "maxConnections": 5, "autoMigrate": true },
  "payin": {
    "lookbackBlocks": 50000,
    "defaultExpirationMinutes": 30
  },
  "assets": {
    "enabled": ["USDC"],
    "USDC": { "address": "0x5425890298aed601595a70AB815c96711a31Bc65", "decimals": 6, "maxPayoutAmount": "1000" }
  },
  "blockchain": { "minConfirmations": 2, "waitForReceipt": false },
  "webhook": { "retryAttempts": 3 },
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
| `001_init.sql` | Full schema: clients (multi-tenant), pay-ins, payouts, audit events, derivation counter, idempotency keys, webhook outbox + delivery log |

---

## Authentication model

| Audience | Header | Source |
|---|---|---|
| Platform operator | `x-avasettle-api-key: <admin key>` | `AVASETTLE_ADMIN_API_KEY` env var |
| Client (institution) | `x-avasettle-api-key: <client key>` or `Authorization: Bearer <client key>` | Issued by `POST /v1/admin/clients`, rotatable via `POST /v1/admin/clients/:id/rotate-key` |

Admin endpoints: `/v1/admin/clients*`, `/v1/reconciliation/run`, `/v1/reports/sweep-queue`.
Everything else under `/v1/*` and `/api/*` requires a client key and only sees that client's data.

---

## Smart contracts

Avalanche-native contracts under `contracts/` (Foundry). They are self-contained:
`pnpm contracts:setup` vendors the libs (forge-std + OpenZeppelin 5.x from
`node_modules`), then `pnpm contracts:build` / `pnpm contracts:test` work.
CI runs format-check + build + the full test suite (70 tests).

| Contract | Purpose |
|---|---|
| `PaymentRouter.sol` | Programmable invoice rail — payer settles a USDC invoice straight to treasury in one tx |
| `SettlementVault.sol` | On-chain payout rail — operators pay beneficiaries from the treasury, single or atomic batch |
| `PrivateSettlementRegistry.sol` | Experimental eERC roadmap step — settlement commitments (confidential amount/counterparty) with selective auditor verification |

```bash
pnpm contracts:setup            # one-time: vendor forge-std + OpenZeppelin
pnpm contracts:test             # forge test (70 tests)

# Deploy (Fuji shown; use --rpc-url avalanche for mainnet). Signing uses a
# Foundry keystore (--account/--sender); TREASURY|FUNDER and optional OWNER
# (multisig) come from the env. Use --private-key instead of --account if preferred.
TREASURY=… forge script contracts/script/Deploy.s.sol \
  --rpc-url avalanche_fuji --account <keystore> --sender <addr> --broadcast --verify
FUNDER=… OPERATOR=… forge script contracts/script/DeploySettlementVault.s.sol \
  --rpc-url avalanche_fuji --account <keystore> --sender <addr> --broadcast --verify
REGISTRAR=… forge script contracts/script/DeployPrivateSettlementRegistry.s.sol \
  --rpc-url avalanche_fuji --account <keystore> --sender <addr> --broadcast --verify
```

After deployment set `AVASETTLE_PAYMENT_ROUTER_ADDRESS` (and, when used,
`AVASETTLE_SETTLEMENT_VAULT_ADDRESS`, `AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS`).

**PaymentRouter** highlights:
- `payInvoice(invoiceRef, token, amount, metadata)` → `invoiceId = keccak256(invoiceRef, token, amount)`; the id binds token + amount, so an invoice is consumed only by paying it *exactly* (no underpay / wrong-token invoice-locking)
- `payInvoiceWithPermit(...)` — EIP-2612: pay in a single tx with no prior `approve`
- `emergencyWithdraw` (owner-only), `minAmount` per token, `invoicePaid` double-pay guard, `Ownable2Step` handover, `Pausable`, `ReentrancyGuard`

**SettlementVault** highlights: pull-based & non-custodial (funds never rest in the contract), `payout` + atomic `payoutBatch` (≤256), operator/funder role split, per-payout replay guard, attributable `PayoutExecuted` events.

> EVM target is `cancun` (Avalanche C-Chain has the Durango opcodes: MCOPY, transient storage). Only non-rebasing, non-fee-on-transfer tokens may be whitelisted (USDC/USDT qualify).

---

## Webhooks

AvaSettle fires webhooks to each client's configured `webhookUrl` for lifecycle events. Payloads are signed with the client's `webhookSecret`: `x-avasettle-signature: sha256=<hmac-hex>`.

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

Delivery is durable: events are written to a PostgreSQL outbox (`avasettle_webhook_outbox`) in the request path and drained by a background dispatcher (every `webhook.dispatchIntervalSeconds`, default 5s). Failed attempts are retried with backoff (1s → 5s → 30s) and survive process restarts; multiple instances can dispatch concurrently (`FOR UPDATE SKIP LOCKED`). Terminal outcomes are logged to `avasettle_webhook_deliveries` and queryable via `GET /v1/reports/webhook-deliveries`.

---

## Auto-sweep

Set `autoSweep: true` in config (or `AVASETTLE_AUTO_SWEEP=true`) to automatically top up and sweep derived-address pay-ins when they confirm. Fires in the background — never blocks reconciliation. PaymentRouter pay-ins are excluded (they settle directly to treasury).

---

## Deployment path: local → Fuji → mainnet

Never deploy straight to mainnet. The promotion path is:

### Stage 1 — Local (Docker Compose)

1. `docker compose up --build`
2. `bash scripts/smoke.sh` — liveness, readiness, client registration, auth, scoping.
3. With Fuji secrets in `.env`: run the demo flows (`pnpm demo:payin:create`,
   `pnpm demo:payin:reconcile`, `pnpm demo:reports`) against `http://localhost:3001`.

### Stage 2 — Fuji testnet (public)

1. Fund a treasury wallet with Fuji AVAX ([faucet](https://core.app/tools/testnet-faucet/)) and test USDC.
2. Deploy the PaymentRouter to Fuji:
   ```bash
   forge script contracts/script/Deploy.s.sol \
     --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast
   ```
   Set `AVASETTLE_PAYMENT_ROUTER_ADDRESS` to the deployed address.
3. Deploy the API to cloud (Cloud Run section below) with `AVASETTLE_NETWORK=avalanche-fuji`.
4. Run `scripts/smoke.sh` against the public URL, then exercise a full real
   pay-in: create → pay USDC from an external wallet → reconcile → sweep → webhook received.
5. Let auto-reconcile + webhook dispatcher run for a few days; watch
   `GET /v1/reports/webhook-deliveries` and `GET /v1/reports/sweep-queue` (admin).

### Stage 3 — Mainnet checklist

- [ ] `AVASETTLE_NETWORK=avalanche-mainnet`
- [ ] `AVASETTLE_USDC_ADDRESS=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` (mainnet USDC — verify on [Circle's site](https://developers.circle.com/stablecoins/usdc-contract-addresses))
- [ ] PaymentRouter deployed to mainnet and verified on Snowtrace
- [ ] Fresh treasury key + fresh mnemonic (never reuse testnet secrets)
- [ ] `AVASETTLE_MAX_PAYOUT_USDC` set to a conservative per-payout cap
- [ ] `AVASETTLE_MIN_CONFIRMATIONS` ≥ 2, `AVASETTLE_TRUST_PROXY` set for your LB
- [ ] `AVASETTLE_DATABASE_SSL=true` against managed Postgres
- [ ] Treasury funded with only the working-capital AVAX/USDC you can afford on a hot wallet
- [ ] Alerts on `/health/readiness` and on failed webhook deliveries

---

## Deploy to Cloud Run

```bash
# Store secrets
printf '%s' "$AVASETTLE_ADMIN_API_KEY"         | gcloud secrets create avasettle-admin-api-key --data-file=-
printf '%s' "$AVASETTLE_TREASURY_PRIVATE_KEY"  | gcloud secrets create avasettle-treasury-private-key --data-file=-
printf '%s' "$AVASETTLE_PAYIN_MNEMONIC"        | gcloud secrets create avasettle-payin-mnemonic --data-file=-
printf '%s' "$AVASETTLE_DATABASE_URL"          | gcloud secrets create avasettle-database-url --data-file=-

# Deploy
gcloud run deploy avasettle \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --set-secrets \
    AVASETTLE_ADMIN_API_KEY=avasettle-admin-api-key:latest,\
    AVASETTLE_TREASURY_PRIVATE_KEY=avasettle-treasury-private-key:latest,\
    AVASETTLE_PAYIN_MNEMONIC=avasettle-payin-mnemonic:latest,\
    AVASETTLE_DATABASE_URL=avasettle-database-url:latest
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
- Rotate client keys with `POST /v1/admin/clients/:id/rotate-key`; disable a client with `PATCH /v1/admin/clients/:id {"status": "disabled"}`.
- `GET /health/readiness` reports database reachability, treasury key, mnemonic, token addresses, RPC, and registered client count.

---

## License

MIT — see [LICENSE](LICENSE).

---

## References

- [Avalanche Fuji network parameters](https://build.avax.network/docs/quick-start/networks/fuji-testnet)
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [Cloud Run source deployment](https://cloud.google.com/run/docs/deploying-source-code)
