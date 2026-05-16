# AvaSettle On-chain Provider

NestJS backend module for AvaSettle, the Avalanche on-chain provider consumed by Chain Flow or another institutional orchestrator.

This service is intentionally isolated from the existing Parmelia Worker and is not part of the Parmelia pnpm workspace. Parmelia keeps its current `server/`, `client/`, `shared/` and `contracts/` flows; `avasettle/` adds a B2B provider API for stablecoin payouts on Avalanche.

## Scope

- Validates B2B calls with `x-avasettle-api-key` or `Authorization: Bearer`.
- Prepares idempotent payout intents from Chain Flow.
- Authorizes and broadcasts ERC-20 treasury transfers with `viem`.
- Reconciles transaction receipts and confirmation depth.
- Exposes treasury status and balances.
- Records an in-memory audit trail behind a repository boundary.

The current ledger is in memory so the hackathon backend is easy to run. The `PayoutLedgerService` is the replacement point for Postgres, D1, DynamoDB or another durable ledger.

## Foundry And Smart Contracts

This backend does not include Foundry or new Solidity contracts by design.

AvaSettle, in its current on-chain provider scope, does not deploy protocol contracts. It signs and broadcasts ERC-20 `transfer` calls from an institutional treasury wallet to a beneficiary address on Avalanche C-Chain. That means the only contract interface needed for the first version is the standard ERC-20 ABI used through `viem`.

This is acceptable for the hackathon backend if the target flow is:

1. Chain Flow creates and approves a payout request.
2. AvaSettle validates the request and treasury policy.
3. AvaSettle transfers an already-existing stablecoin token, such as USDC or USDT, on Avalanche.
4. AvaSettle reconciles the resulting transaction hash.

Add Foundry and Solidity later if the product needs custom escrow, batch settlement, multi-sig vaults, programmable limits, institution-specific settlement contracts, or on-chain attestations. Until then, adding contracts would increase scope without improving the payout provider MVP.

## Commands

Install and run from this folder only:

```bash
cd avasettle
pnpm install
pnpm start:dev
pnpm build
pnpm test
pnpm test:e2e
```

## Environment

Copy `.env.example` into a local `.env` file and configure:

```bash
PORT=3001
AVASETTLE_API_KEY=change-me
AVASETTLE_NETWORK=avalanche-fuji
AVASETTLE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVASETTLE_TREASURY_PRIVATE_KEY=0x...
AVASETTLE_ENABLED_ASSETS=USDC
AVASETTLE_USDC_ADDRESS=0x...
AVASETTLE_USDC_DECIMALS=6
AVASETTLE_MAX_PAYOUT_USDC=1000
```

Do not rely on default token addresses for production. Configure the exact stablecoin contract used by the institution and selected Avalanche network.

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

All `/v1/*` endpoints require the API key.

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

## Payout Statuses

- `prepared`: request validated and stored, but not sent on-chain.
- `authorized`: approval step started.
- `broadcasted`: transaction hash exists and is pending/finalizing on-chain.
- `confirmed`: transaction succeeded and reached the configured confirmation count.
- `failed`: transaction reverted or execution failed.

## Operational Notes

- Use a dedicated treasury hot wallet with limited funds for demos.
- Keep token contract addresses explicit per network and institution.
- Rotate `AVASETTLE_API_KEY` before shared demos.
- Replace the in-memory ledger before production.
- Add transaction policy checks before supporting mainnet volume.
