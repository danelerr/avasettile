# AvaSettle Institutional Stablecoin Payments API

NestJS backend for AvaSettle, an institutional B2B API for stablecoin pay-ins, reconciliation, treasury sweep, settlement, and payouts on Avalanche.

Chain Flow is one enterprise integration example. AvaSettle is not a Chain Flow plugin and is not a retail wallet. It is infrastructure that PSPs, fintechs, remittance companies, banks, and merchants can integrate to receive USDC, reconcile invoices, move funds into treasury, and execute outbound disbursements.

This service is intentionally isolated from the existing Parmelia Worker and is not part of the Parmelia pnpm workspace. Parmelia keeps its current `server/`, `client/`, `shared/` and `contracts/` flows; `avasettle/` adds an independent B2B provider API.

## Scope

- Validates B2B calls with `x-avasettle-api-key` or `Authorization: Bearer`.
- Creates pay-ins so customers of institutions can pay in USDC.
- Creates real EVM pay-in deposit addresses from a configured mnemonic.
- Optionally creates programmable PaymentRouter invoices.
- Scans ERC-20 `Transfer` logs to reconcile pay-ins.
- Sweeps funds from derived deposit addresses into institutional treasury.
- Confirms to the institution that an invoice/customer payment was received.
- Authorizes and broadcasts ERC-20 treasury payouts with `viem`.
- Reconciles transaction receipts and confirmation depth.
- Exposes treasury status and balances.
- Records a ledger and audit trail behind a repository boundary, using either a local JSON file or PostgreSQL through `pg`.
- Provides reports, mock risk scoring, simulated fiat settlement, and experimental private settlement receipts.

The default ledger persists to `AVASETTLE_STORAGE_FILE`, defaulting to `data/avasettle-ledger.json`. For Cloud SQL PostgreSQL or Firebase SQL Connect-backed demos, set `AVASETTLE_STORAGE_DRIVER=postgres` and `AVASETTLE_DATABASE_URL`. AvaSettle uses raw SQL through `pg`; there is no Prisma, TypeORM, Sequelize, Drizzle or other ORM.

The normalized institutional schema lives in `db/migrations/001_init_avasettle.sql`, copied from `bd.sql`. It includes institutions, merchants, assets, treasury wallets, pay-ins, PaymentRouter intents, payouts, blockchain transactions, settlements, risk assessments, audit events, idempotency keys, webhooks, eERC/private-payment placeholders, and operational views. `db/migrations/002_runtime_state.sql` adds a small runtime-state table so the current NestJS services can persist their existing ledger contract while the normalized repositories are adopted incrementally.

## Smart Contracts

This iteration includes a minimal Foundry project for `PaymentRouter.sol`:

```txt
contracts/src/PaymentRouter.sol
foundry.toml
```

`PaymentRouter` is an optional Avalanche-native invoice rail. It uses OpenZeppelin `Ownable`, `Pausable`, `ReentrancyGuard`, and `SafeERC20`. A payer approves USDC to the router, calls `payInvoice`, and the contract transfers funds directly to the configured treasury while emitting an `InvoicePaid` event that AvaSettle can reconcile.

Compile contracts from `avasettle/`:

```bash
pnpm contracts:build
```

The default pay-in mode still uses derived EVM deposit addresses. PaymentRouter is optional and enabled only when `AVASETTLE_PAYMENT_ROUTER_ADDRESS` is configured.

## Commands

Install and run from this folder only:

```bash
cd avasettle
pnpm install
pnpm start:dev
pnpm build
pnpm test
pnpm test:e2e
pnpm db:check
pnpm db:migrate
```

## Environment

Copy `.env.example` into a local `.env` file and configure it from inside `avasettle/`:

```bash
PORT=3001
NODE_ENV=development
AVASETTLE_API_KEY=pon-una-key-generada
AVASETTLE_NETWORK=avalanche-fuji
AVASETTLE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVASETTLE_EXPLORER_BASE_URL=https://subnets-test.avax.network/c-chain
AVASETTLE_STORAGE_DRIVER=json
AVASETTLE_STORAGE_FILE=data/avasettle-ledger.json
AVASETTLE_DATABASE_URL=
AVASETTLE_DATABASE_SSL=false
AVASETTLE_DATABASE_MAX_CONNECTIONS=5
AVASETTLE_DATABASE_RUNTIME_STATE_KEY=default
AVASETTLE_DATABASE_AUTO_MIGRATE=false
AVASETTLE_TREASURY_PRIVATE_KEY=0x...
AVASETTLE_PAYIN_MNEMONIC="..."
AVASETTLE_PAYIN_DERIVATION_ACCOUNT=0
AVASETTLE_PAYIN_LOOKBACK_BLOCKS=50000
AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES=30
AVASETTLE_PAYMENT_ROUTER_ADDRESS=
AVASETTLE_ENABLED_ASSETS=USDC
AVASETTLE_USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
AVASETTLE_USDC_DECIMALS=6
AVASETTLE_MAX_PAYOUT_USDC=1000
AVASETTLE_MIN_CONFIRMATIONS=2
AVASETTLE_WAIT_FOR_RECEIPT=false
AVASETTLE_CORS_ORIGINS=*
AVASETTLE_RISK_REVIEW_AMOUNT=10000
AVASETTLE_RISK_REJECT_AMOUNT=50000
AVASETTLE_SETTLEMENT_FIAT_CURRENCY=BOB
AVASETTLE_SETTLEMENT_FIAT_RATE=10
AVASETTLE_PRIVACY_MODE=off
AVASETTLE_EERC_CONTRACT_ADDRESS=
```

How to obtain each value for a Fuji demo:

| Variable | How to get it |
| --- | --- |
| `PORT` | Use `3001` locally. Cloud Run injects `PORT`, usually `8080`, so do not hardcode it in deployment. |
| `AVASETTLE_API_KEY` | Generate a shared B2B demo secret, for example `openssl rand -hex 32`. Chain Flow must send it as `x-avasettle-api-key` or `Authorization: Bearer <key>`. |
| `AVASETTLE_NETWORK` | Use `avalanche-fuji` for the hackathon demo. |
| `AVASETTLE_RPC_URL` | Use Avalanche Fuji C-Chain RPC `https://api.avax-test.network/ext/bc/C/rpc`, or a dedicated provider RPC if the demo needs higher reliability. |
| `AVASETTLE_EXPLORER_BASE_URL` | Use `https://subnets-test.avax.network/c-chain` for Fuji transaction inspection. |
| `AVASETTLE_STORAGE_DRIVER` | Use `json` for local demos without infrastructure. Use `postgres` when connecting to Firebase SQL Connect / Cloud SQL PostgreSQL. |
| `AVASETTLE_STORAGE_FILE` | Use `data/avasettle-ledger.json` locally. On Cloud Run demos use `/tmp/avasettle-ledger.json`; this is ephemeral and must be replaced by a database for production. |
| `AVASETTLE_DATABASE_URL` | PostgreSQL connection string for Cloud SQL or the SQL Connect emulator database. Required when `AVASETTLE_STORAGE_DRIVER=postgres`. |
| `AVASETTLE_DATABASE_SSL` | Set `true` when the PostgreSQL endpoint requires TLS, commonly for managed public endpoints. Keep `false` for local emulator/PGlite or Cloud SQL Unix-socket/proxy setups. |
| `AVASETTLE_DATABASE_MAX_CONNECTIONS` | Connection pool size for `pg`. Keep small for Cloud Run, for example `5`. |
| `AVASETTLE_DATABASE_RUNTIME_STATE_KEY` | Logical key for the runtime ledger row in `avasettle_runtime_state`. Use `default` unless running multiple isolated demo ledgers in one database. |
| `AVASETTLE_DATABASE_AUTO_MIGRATE` | Set `true` only for controlled demo environments where the API can run SQL migrations on startup. Prefer `pnpm db:migrate` for production-like deployments. |
| `AVASETTLE_TREASURY_PRIVATE_KEY` | Create a dedicated demo EVM wallet, export only that demo private key, fund it with Fuji AVAX for gas and Fuji USDC for payouts. Do not use a personal wallet or mainnet key. |
| `AVASETTLE_PAYIN_MNEMONIC` | Generate a separate demo mnemonic dedicated to pay-in deposit address derivation. It controls funds sent to derived addresses. |
| `AVASETTLE_PAYIN_DERIVATION_ACCOUNT` | Keep `0` unless you intentionally want another HD account branch. |
| `AVASETTLE_PAYIN_LOOKBACK_BLOCKS` | Keep `50000` for demos. Increase only if reconciling old pay-ins. |
| `AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES` | Default expiration for pay-in requests when the API request does not send `expiresInMinutes`. |
| `AVASETTLE_PAYMENT_ROUTER_ADDRESS` | Optional deployed `PaymentRouter` contract address. Required only for `collectionMode=payment-router`. |
| `AVASETTLE_ENABLED_ASSETS` | Use `USDC` for the Fuji demo unless USDT is also configured. |
| `AVASETTLE_USDC_ADDRESS` | Fuji USDC contract address from Circle docs: `0x5425890298aed601595a70AB815c96711a31Bc65`. |
| `AVASETTLE_USDC_DECIMALS` | Use `6` for USDC. |
| `AVASETTLE_MAX_PAYOUT_USDC` | Demo treasury policy limit. Keep low, for example `1000`. |
| `AVASETTLE_MIN_CONFIRMATIONS` | Minimum confirmation depth before reconciliation marks a transfer final. Use `2` for demo. |
| `AVASETTLE_WAIT_FOR_RECEIPT` | Use `false` for fast authorization demos that return a `txHash` immediately; use `true` if the API should wait for a receipt. |
| `AVASETTLE_CORS_ORIGINS` | Use `*` for hackathon demos, or a comma-separated list of Chain Flow/frontend origins. |
| `AVASETTLE_RISK_REVIEW_AMOUNT` | Mock risk threshold that returns review. |
| `AVASETTLE_RISK_REJECT_AMOUNT` | Mock risk threshold that rejects before payout creation. |
| `AVASETTLE_SETTLEMENT_FIAT_CURRENCY` | Simulated settlement fiat currency, for example `BOB`, `COP`, `MXN`, or `USD`. |
| `AVASETTLE_SETTLEMENT_FIAT_RATE` | Demo conversion rate used by simulated settlements. |
| `AVASETTLE_PRIVACY_MODE` | `off`, `metadata-redaction`, or `eerc-experimental`. Experimental privacy endpoints reject requests while this is `off`. |
| `AVASETTLE_EERC_CONTRACT_ADDRESS` | Optional eERC/private-settlement contract address. Required only for `eerc-experimental` receipts. |

Do not rely on default token addresses for production. Configure the exact stablecoin contract used by the institution and selected Avalanche network.

Do not configure pay-ins with a throwaway mnemonic in production. `AVASETTLE_PAYIN_MNEMONIC` derives real EVM addresses, so it controls funds received at those addresses.

## PostgreSQL And Firebase SQL Connect

This iteration reads `bd.sql` as the intended PostgreSQL model and keeps it as `db/migrations/001_init_avasettle.sql`. Run migrations with raw SQL and `pg`:

```bash
cd avasettle
AVASETTLE_DATABASE_URL=postgresql://user:password@host:5432/avasettle pnpm db:check
AVASETTLE_DATABASE_URL=postgresql://user:password@host:5432/avasettle pnpm db:migrate
```

To make the API use PostgreSQL for the current ledger:

```bash
AVASETTLE_STORAGE_DRIVER=postgres
AVASETTLE_DATABASE_URL=postgresql://user:password@host:5432/avasettle
```

`/health/readiness` now reports `storage.driver`, database configuration and `checks.databaseReady`. In `json` mode the database check is non-blocking. In `postgres` mode, missing or unreachable PostgreSQL leaves readiness as `degraded`.

Firebase SQL Connect structure is included under:

```txt
firebase.json
.firebaserc
dataconnect/dataconnect.yaml
dataconnect/schema/schema.gql
dataconnect/institutional/connector.yaml
dataconnect/institutional/queries.gql
dataconnect/institutional/mutations.gql
```

Setup flow for Firebase SQL Connect / Cloud SQL PostgreSQL:

```bash
cd avasettle
npm install -g firebase-tools
firebase login
firebase use <firebase-project-id>
firebase init dataconnect
```

For this repo the Firebase project is pinned in `.firebaserc`:

```json
{
  "projects": {
    "default": "test-bd-9817c"
  }
}
```

The current Data Connect service discovered by Firebase CLI is:

| Setting | Value |
| --- | --- |
| Project ID | `test-bd-9817c` |
| Service ID | `test-bd-9817c-service` |
| Location | `us-east4` |
| Cloud SQL instance | `test-bd-9817c-instance` |
| Database | `test-bd-9817c-database` |

Keep the generated Firebase project settings, then preserve AvaSettle's `dataconnect/` schema and connector files. `dataconnect/dataconnect.yaml` is aligned with the existing service:

```yaml
serviceId: test-bd-9817c-service
location: us-east4
schema:
  source: ./schema
  datasource:
    postgresql:
      database: test-bd-9817c-database
      cloudSql:
        instanceId: test-bd-9817c-instance
        schemaValidation: COMPATIBLE
connectorDirs:
  - ./institutional
```

Use the SQL Connect emulator/PGlite for local connector work through the Firebase CLI and VS Code extension. Deploy schemas, queries and mutations with:

```bash
firebase deploy --only dataconnect
```

The NestJS backend still talks to PostgreSQL directly through `pg`. Firebase SQL Connect gives the project versioned GraphQL schema, queries and mutations for Firebase-managed clients and tooling; it is not used as an ORM inside AvaSettle.

## Fuji Demo Flow

Start locally:

```bash
cd avasettle
pnpm install
pnpm start:dev
```

Check readiness:

```bash
pnpm demo:health
```

Prepare a Chain Flow withdrawal with the exact provider payload:

```bash
DEMO_EXTERNAL_ID=EXT-0001 \
DEMO_AMOUNT=10 \
DEMO_TO_ADDRESS=0x1111111111111111111111111111111111111111 \
pnpm demo:chainflow:prepare
```

Authorize and broadcast the ERC-20 payout:

```bash
DEMO_EXTERNAL_ID=EXT-0001 pnpm demo:chainflow:authorize
```

The response should include `txHash` once the treasury wallet is funded with AVAX and USDC on Fuji.

Consult status:

```bash
DEMO_EXTERNAL_ID=EXT-0001 pnpm demo:chainflow:status
```

Create a real pay-in deposit address:

```bash
PAYIN_EXTERNAL_ID=PAYIN-DEMO-0001 PAYIN_AMOUNT=10 pnpm demo:payin:create
```

Send Fuji USDC to the returned `depositAddress`, then reconcile:

```bash
PAYIN_ID=<id returned by create> pnpm demo:payin:reconcile
```

Sweep the derived pay-in address into treasury. The derived address must hold Fuji AVAX for gas:

```bash
PAYIN_ID=<id returned by create> pnpm demo:payin:sweep
```

Create a programmable PaymentRouter invoice instead of a derived address:

```bash
AVASETTLE_PAYMENT_ROUTER_ADDRESS=0x... \
PAYIN_EXTERNAL_ID=ROUTER-INVOICE-0001 \
PAYIN_AMOUNT=10 \
pnpm demo:router:invoice
```

The response includes `routerInvoiceId` and `depositAddress` equal to the router contract. The payer must approve the router for USDC and call `payInvoice(routerInvoiceId, USDC, amountAtomic, metadata)`.

Create an experimental private settlement receipt:

```bash
AVASETTLE_PRIVACY_MODE=metadata-redaction pnpm demo:privacy:create
```

Review institutional summary:

```bash
pnpm demo:reports
```

## Deploy To Cloud Run

`Dockerfile` is included for a container-based deployment. Cloud Run injects the `PORT` environment variable into the ingress container, and AvaSettle already reads `PORT` through `ConfigurationService`.

For a hackathon/free-tier style deployment, keep minimum instances at `0`, use Fuji, keep payout limits low, and store secrets in Secret Manager. Cloud Run's filesystem is ephemeral, so `AVASETTLE_STORAGE_FILE=/tmp/avasettle-ledger.json` is acceptable only for a demo. Use a durable database before production or any real institutional pilot.

Create secrets:

```bash
printf '%s' "$AVASETTLE_API_KEY" | gcloud secrets create avasettle-api-key --data-file=-
printf '%s' "$AVASETTLE_TREASURY_PRIVATE_KEY" | gcloud secrets create avasettle-treasury-private-key --data-file=-
printf '%s' "$AVASETTLE_PAYIN_MNEMONIC" | gcloud secrets create avasettle-payin-mnemonic --data-file=-
```

Deploy from inside `avasettle/`:

```bash
gcloud run deploy avasettle \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --set-env-vars NODE_ENV=production,AVASETTLE_NETWORK=avalanche-fuji,AVASETTLE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc,AVASETTLE_EXPLORER_BASE_URL=https://subnets-test.avax.network/c-chain,AVASETTLE_STORAGE_FILE=/tmp/avasettle-ledger.json,AVASETTLE_ENABLED_ASSETS=USDC,AVASETTLE_USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65,AVASETTLE_USDC_DECIMALS=6,AVASETTLE_MAX_PAYOUT_USDC=1000,AVASETTLE_MIN_CONFIRMATIONS=2,AVASETTLE_WAIT_FOR_RECEIPT=false,AVASETTLE_CORS_ORIGINS=*,AVASETTLE_PRIVACY_MODE=off \
  --set-secrets AVASETTLE_API_KEY=avasettle-api-key:latest,AVASETTLE_TREASURY_PRIVATE_KEY=avasettle-treasury-private-key:latest,AVASETTLE_PAYIN_MNEMONIC=avasettle-payin-mnemonic:latest
```

After deployment:

```bash
API_BASE_URL=https://<cloud-run-url> pnpm demo:health
API_BASE_URL=https://<cloud-run-url> DEMO_EXTERNAL_ID=EXT-0001 pnpm demo:chainflow:prepare
```

## Swagger / OpenAPI

The API is documented with the official NestJS OpenAPI integration using `@nestjs/swagger`, `DocumentBuilder`, and `SwaggerModule`.

After starting the server:

```bash
pnpm start:dev
```

Open:

```txt
http://localhost:3001/docs
http://localhost:3001/docs/json
```

Use one of the available security schemes in Swagger:

- `x-avasettle-api-key`: sends the B2B API key in the `x-avasettle-api-key` header.
- `chain-flow-bearer`: sends the same API key as `Authorization: Bearer <key>`.

## API Contract For Chain Flow

All `/v1/*` and `/api/*` endpoints require the API key, except public health/metadata endpoints.

Common headers:

```http
x-avasettle-api-key: change-me
x-institution-id: chain-flow
x-correlation-id: payout-123
idempotency-key: payout-123
content-type: application/json
```

## What Each Endpoint Does

### `GET /`

Public metadata endpoint.

It returns the service name, product name, provider role, version, and active Avalanche network. Use it for smoke tests and to confirm that Chain Flow is pointed at the correct AvaSettle provider.

### `GET /health`

Public liveness check.

It confirms that the NestJS process is alive. It does not check treasury keys, token configuration, or RPC connectivity. Use this for uptime checks and container health probes.

### `GET /health/readiness`

Public readiness check.

It checks whether AvaSettle is operationally ready to process payouts:

- API key configured.
- Treasury private key configured.
- Pay-in mnemonic configured.
- Enabled token assets have contract addresses.
- Avalanche RPC is reachable and returns the expected chain id.

If this endpoint returns `degraded`, the service is running but should not be used for real payout execution yet.

### `GET /v1/treasury/status`

Protected treasury configuration endpoint.

It returns non-secret operational configuration:

- selected Avalanche network;
- derived treasury address if the private key is configured;
- enabled assets such as USDC or USDT;
- configured token contract addresses and decimals;
- maximum payout amount per token;
- minimum confirmation threshold;
- whether payout execution waits for receipts.
- whether pay-in mnemonic derivation is configured.

It never returns the treasury private key.

### `GET /v1/treasury/balances`

Protected treasury balance endpoint.

It reads on-chain balances for:

- native AVAX balance of the treasury wallet;
- each configured ERC-20 stablecoin balance.

Chain Flow can use this before authorizing large payout batches or as a dashboard liquidity check.

### `POST /v1/payouts`

Protected payout preparation endpoint.

It receives a payout request from Chain Flow and creates a prepared payout record. It validates:

- `externalId` format;
- asset support;
- amount format and maximum amount policy;
- beneficiary EVM address;
- configured token address.

It converts the human token amount into atomic units using the configured decimals. It does not broadcast by default. If the same `externalId` is sent again, AvaSettle returns the existing payout instead of creating a duplicate.

```http
POST /v1/payouts
```

Request:

```json
{
  "externalId": "chainflow-payout-0001",
  "chainFlowRequestId": "cf-req-0001",
  "asset": "USDC",
  "amount": "25.50",
  "beneficiaryAddress": "0x1111111111111111111111111111111111111111",
  "beneficiaryName": "Cliente LATAM",
  "memo": "Payout approved by Chain Flow",
  "metadata": {
    "country": "BO",
    "fiatRail": "bank-transfer"
  }
}
```

### `GET /v1/payouts`

Protected payout listing endpoint.

It returns payout records known by this provider, ordered by most recent creation time. It supports filters:

```http
GET /v1/payouts?status=broadcasted
GET /v1/payouts?externalId=chainflow-payout-0001
```

Use it for operations dashboards, reconciliation queues, and support lookups.

### `GET /v1/payouts/:id`

Protected payout detail endpoint.

It returns a single payout record, including:

- lifecycle status;
- amount and atomic amount;
- beneficiary address;
- treasury address;
- transaction hash, if broadcasted;
- failure reason, if failed;
- timestamps;
- audit trail.

### `POST /v1/payouts/:id/authorize`

Protected authorization and broadcast endpoint.

It moves a prepared payout into execution. The service:

1. Marks the payout as authorized.
2. Records the approving actor and risk decision metadata.
3. Reads treasury token balance.
4. Simulates the ERC-20 transfer with `viem`.
5. Signs the transaction with `AVASETTLE_TREASURY_PRIVATE_KEY`.
6. Broadcasts the transfer to Avalanche.
7. Stores the resulting transaction hash.

```http
POST /v1/payouts/:id/authorize
```

```json
{
  "approvedBy": "chain-flow",
  "riskDecisionId": "risk-ok-0001",
  "notes": "Approved by institutional payout workflow"
}
```

If the payout was already broadcasted or confirmed, the endpoint returns the existing payout instead of broadcasting again.

### `POST /v1/payouts/:id/reconcile`

Protected on-chain reconciliation endpoint.

It reads the transaction receipt for a broadcasted payout and updates the payout state:

- no receipt yet: payout remains `broadcasted`;
- reverted receipt: payout becomes `failed`;
- successful receipt with enough confirmations: payout becomes `confirmed`.

Chain Flow should call this endpoint after broadcast or run it from a scheduled reconciliation worker.

### `POST /api/prepararretiro`

Protected Chain Flow compatibility endpoint.

It accepts the exact Chain Flow withdrawal payload and maps it to `POST /v1/payouts`.

Exact payload expected by Chain Flow:

```json
{
  "tcTransaccionExterna": "EXT-0001",
  "tnMonto": 10,
  "tnMoneda": 1,
  "tcCuentaDestino": "0x1111111111111111111111111111111111111111",
  "tnRetiroPago": 12345,
  "tnTransferenciaBloque": 9001,
  "tnProcesadorPagos": 3
}
```

Mapping rules:

- `tcTransaccionExterna` becomes AvaSettle `externalId` and is the preferred idempotency key.
- `tnMonto` becomes the payout amount.
- `tnMoneda=1` maps to `USDC`; `tnMoneda=2` maps to `USDT`.
- `tcCuentaDestino` becomes the beneficiary EVM address.
- `tnRetiroPago`, `tnTransferenciaBloque`, `tnProcesadorPagos`, `tnMoneda`, and `tcCuentaDestino` are persisted under `metadata.chainFlow` for audit and status lookup.

The endpoint also keeps the previous aliases for compatibility:

- `idRetiro`, `id_retiro`, or `externalId`;
- `monto` or `amount`;
- `moneda` or `asset`;
- `wallet`, `direccionDestino`, or `beneficiaryAddress`.

It also runs the mock risk model before preparing the payout. If risk returns `reject`, the request is rejected before any payout is created.

Example:

```json
{
  "codigo": "00",
  "mensaje": "Retiro preparado.",
  "tcTransaccionExterna": "EXT-0001",
  "tnRetiroPago": 12345,
  "tnTransferenciaBloque": 9001,
  "tnProcesadorPagos": 3,
  "tnMoneda": 1,
  "tcCuentaDestino": "0x1111111111111111111111111111111111111111",
  "retiroId": "EXT-0001",
  "payoutId": "7b4d9f4d-74a8-4e20-91b7-b8dd3af46177",
  "estado": "prepared",
  "estadoChainFlow": "PREPARADO",
  "txHash": null
}
```

### `POST /api/autorizarretiro`

Protected Chain Flow compatibility endpoint.

It locates a prepared payout by `payoutId`, `tcTransaccionExterna`, `externalId`, `idRetiro`, `id_retiro`, `tnRetiroPago`, or `tnTransferenciaBloque`, then calls the same authorization/broadcast path used by `POST /v1/payouts/:id/authorize`.

Example:

```json
{
  "tcTransaccionExterna": "EXT-0001"
}
```

### `GET /api/consultarestadoretiro`

Protected Chain Flow compatibility endpoint.

It returns a provider-style status response for a payout. Query by `payoutId`, `tcTransaccionExterna`, `externalId`, `idRetiro`, `id_retiro`, `tnRetiroPago`, or `tnTransferenciaBloque`.

```http
GET /api/consultarestadoretiro?tcTransaccionExterna=EXT-0001
```

### `POST /api/consultarestadoretiro`

Protected Chain Flow compatibility endpoint.

Same behavior as the GET variant, but accepts a JSON body for providers/orchestrators that standardize on POST status lookups.

### `POST /v1/payins`

Protected pay-in creation endpoint.

By default it derives a real EVM deposit address from `AVASETTLE_PAYIN_MNEMONIC` using an incrementing derivation index, stores the expected amount, and records the current Avalanche block as the scan start.

If `AVASETTLE_PAYIN_MNEMONIC` is not configured, this endpoint returns a service configuration error.

For programmable invoices, set `collectionMode` to `payment-router`. That mode requires `AVASETTLE_PAYMENT_ROUTER_ADDRESS`; AvaSettle returns a `routerInvoiceId` and uses `PaymentRouter.InvoicePaid` events for reconciliation.

Example:

```json
{
  "externalId": "merchant-invoice-0001",
  "asset": "USDC",
  "amount": "100.00",
  "collectionMode": "derived-address",
  "expiresInMinutes": 60,
  "metadata": {
    "country": "BO"
  }
}
```

PaymentRouter example:

```json
{
  "externalId": "merchant-router-invoice-0001",
  "asset": "USDC",
  "amount": "100.00",
  "collectionMode": "payment-router"
}
```

### `GET /v1/payins`

Protected pay-in listing endpoint.

Returns pay-ins ordered by creation time. Supports `status` and `externalId` filters.

### `GET /v1/payins/:id`

Protected pay-in detail endpoint.

Returns deposit address, derivation index, expected amount, received amount, status, transfer hashes, and audit trail.

### `POST /v1/payins/:id/reconcile`

Protected pay-in reconciliation endpoint.

For derived-address pay-ins, it scans ERC-20 `Transfer` logs for the configured token contract where `to` equals the derived deposit address. For PaymentRouter pay-ins, it scans `InvoicePaid` events matching `routerInvoiceId`.

It updates:

- `pending` when no transfer is found;
- `detected` when the exact amount is found but confirmation depth is not enough;
- `confirmed` when exact amount and confirmation depth are sufficient;
- `underpaid` when some funds arrive but less than expected;
- `overpaid` when more than expected arrives;
- `expired` when no funds arrive before expiration.

### `POST /v1/payins/:id/sweep`

Protected treasury sweep endpoint.

For derived-address pay-ins, it derives the signer for the stored `derivationIndex` and transfers the ERC-20 balance from `depositAddress` to the institutional treasury. The deposit address must have AVAX for gas. The endpoint stores `sweepStatus`, `sweepTransactionHash`, `sweptAmount`, and audit events.

PaymentRouter pay-ins settle directly to treasury, so this endpoint returns `sweepStatus=not_required`.

Optional body:

```json
{
  "notes": "Sweep confirmed invoice",
  "amount": "100.00"
}
```

### `POST /v1/reconciliation/run`

Protected semiautomatic reconciliation endpoint.

It attempts to reconcile all `broadcasted` payouts and open pay-ins. Use this from a cron job, worker, or operations dashboard.

### `GET /v1/reports/summary`

Protected institutional report endpoint.

Returns counts by status and basic volume totals for payouts, pay-ins, and simulated fiat settlements.

### `POST /v1/settlements`

Protected simulated fiat settlement endpoint.

Creates a simulated fiat settlement record from a `payout`, `payin`, or `manual` source. It calculates fiat amount using `AVASETTLE_SETTLEMENT_FIAT_RATE`.

### `GET /v1/settlements`

Protected settlement listing endpoint.

Lists simulated settlement records, optionally filtered by status.

### `GET /v1/settlements/:id`

Protected settlement detail endpoint.

Returns one simulated settlement record.

### `POST /v1/settlements/:id/complete`

Protected settlement state endpoint.

Marks a simulated fiat settlement as completed.

### `POST /v1/risk/assess`

Protected risk scoring endpoint.

Runs the encapsulated mock risk model for a payout, pay-in, or address. This is the integration point for a future Wavy Node provider.

### `POST /v1/privacy/settlements`

Protected experimental private settlement endpoint.

Creates a privacy receipt using hashed commitments for amount, metadata, and counterparty. It supports:

- `metadata-redaction`: stores a public amount but hashes metadata/counterparty.
- `eerc-experimental`: stores commitments only and requires `AVASETTLE_EERC_CONTRACT_ADDRESS`.

This module is intentionally experimental. It does not yet submit an eERC transaction; it encapsulates the API boundary for a future private settlement rail.

### `GET /v1/privacy/settlements`

Lists experimental private settlement receipts.

### `GET /v1/privacy/settlements/:id`

Returns one experimental private settlement receipt.

## Payout Statuses

- `prepared`: request validated and stored, but not sent on-chain.
- `authorized`: approval step started.
- `broadcasted`: transaction hash exists and is pending/finalizing on-chain.
- `confirmed`: transaction succeeded and reached the configured confirmation count.
- `failed`: transaction reverted or execution failed.

## Pay-In Statuses

- `pending`: address issued and waiting for funds.
- `detected`: expected funds detected but not enough confirmations yet.
- `confirmed`: exact expected amount received and finalized.
- `underpaid`: received less than expected.
- `overpaid`: received more than expected.
- `expired`: expiration reached without funds.

## Pay-In Sweep Statuses

- `pending`: derived address has not been swept yet.
- `broadcasted`: sweep transaction hash exists.
- `confirmed`: sweep transaction reached receipt confirmation when `AVASETTLE_WAIT_FOR_RECEIPT=true`.
- `failed`: sweep attempt failed, usually because the deposit address has no AVAX for gas.
- `not_required`: PaymentRouter pay-in settled directly to treasury.

## Operational Notes

- Use a dedicated treasury hot wallet with limited funds for demos.
- Use a dedicated pay-in mnemonic and protect it like production key material.
- Derived pay-in addresses need AVAX before they can sweep ERC-20 funds.
- PaymentRouter avoids per-address sweep gas by transferring payer funds directly to treasury.
- Keep token contract addresses explicit per network and institution.
- Rotate `AVASETTLE_API_KEY` before shared demos.
- Use `AVASETTLE_STORAGE_DRIVER=postgres` and Cloud SQL PostgreSQL before production or institutional pilots.
- Add transaction policy checks before supporting mainnet volume.

## References

- Avalanche Fuji network parameters: `https://build.avax.network/docs/quick-start/networks/fuji-testnet`
- Circle USDC contract addresses: `https://developers.circle.com/stablecoins/usdc-contract-addresses`
- NestJS OpenAPI integration: `https://docs.nestjs.com/openapi/introduction`
- Firebase SQL Connect quickstart: `https://firebase.google.com/docs/sql-connect/quickstart?userflow=automatic`
- Firebase SQL Connect configuration reference: `https://firebase.google.com/docs/sql-connect/configuration-reference`
- Cloud Run container runtime contract: `https://cloud.google.com/run/docs/container-contract`
- Cloud Run source deployment: `https://cloud.google.com/run/docs/deploying-source-code`
