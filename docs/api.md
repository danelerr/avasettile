# AvaSettle API Reference

Base URL: `http://localhost:3001` (dev) · `https://<cloud-run-url>` (prod)

---

## Authentication

AvaSettle is multi-tenant. There are two kinds of keys:

| Key | Used for | Header |
|---|---|---|
| **Admin key** (`AVASETTLE_ADMIN_API_KEY`) | Client management (`/v1/admin/clients*`), global reconciliation, sweep queue | `x-avasettle-api-key` |
| **Client key** (issued per institution) | All business endpoints (`/v1/*`, `/api/*`) — scoped to that client's data | `x-avasettle-api-key` or `Authorization: Bearer` |

Public endpoints (`/`, `/health`, `/health/readiness`, and the hosted checkout `/checkout/*`) require no key.

**Header options (either works for client keys):**

```http
x-avasettle-api-key: avk_...
```
```http
Authorization: Bearer avk_...
```

**Common request headers:**

```http
x-correlation-id: req-20260609-001
idempotency-key: payin-invoice-0001
content-type: application/json
```

`idempotency-key` prevents duplicate creation — if the same key is reused by the same client, the existing record is returned unchanged.

---

## Clients (admin)

All endpoints below require the **admin key**.

### `POST /v1/admin/clients`

Register a client (institution) and issue its API key. The plaintext key appears **only in this response** — only its SHA-256 hash is stored.

```json
{
  "name": "Fintech LATAM SA",
  "webhookUrl": "https://api.fintech-latam.example/avasettle/webhooks",
  "webhookSecret": "hook-signing-secret",
  "metadata": { "country": "BO" }
}
```

Response includes `apiKey` (e.g. `avk_<48 hex chars>`) and `apiKeyPrefix` for later identification.

### `GET /v1/admin/clients`

List clients (never includes keys or webhook secrets).

### `GET /v1/admin/clients/:id`

Get client detail.

### `PATCH /v1/admin/clients/:id`

Update name, `status` (`active` / `disabled`), `webhookUrl`, `webhookSecret`, or metadata. Disabled clients are rejected on every API call.

### `POST /v1/admin/clients/:id/rotate-key`

Invalidates the current key immediately and returns a new plaintext key once.

---

## Health

### `GET /`

Public. Returns service metadata.

```json
{
  "service": "AvaSettle On-chain Provider",
  "product": "AvaSettle",
  "role": "avalanche-on-chain-provider",
  "version": "0.2.0",
  "network": {
    "key": "avalanche-fuji",
    "chainId": 43113,
    "name": "Avalanche Fuji Testnet",
    "nativeTokenSymbol": "AVAX",
    "explorerBaseUrl": "https://subnets-test.avax.network/c-chain",
    "rpcUrl": "https://api.avax-test.network/ext/bc/C/rpc"
  }
}
```

### `GET /health`

Public. Liveness check — just confirms the process is running.

```json
{ "status": "ok" }
```

### `GET /health/readiness`

Public. Operational readiness check. Returns `degraded` if key configuration is missing.

```json
{
  "status": "ready",
  "network": { "key": "avalanche-fuji", "chainId": 43113, "name": "Avalanche Fuji Testnet" },
  "database": { "configured": true, "reachable": true },
  "registeredClients": 2,
  "checks": {
    "adminApiKeyConfigured": true,
    "treasuryConfigured": true,
    "payInMnemonicConfigured": true,
    "assetsConfigured": true,
    "databaseReady": true,
    "rpcReachable": true
  }
}
```

Use this endpoint for container health probes and pre-flight checks before routing live traffic.

---

## Pay-ins

### `POST /v1/payins`

Create a pay-in. Returns a unique deposit address the customer should send stablecoins to.

**Request:**

```json
{
  "externalId": "invoice-2026-001",
  "asset": "USDC",
  "amount": "100.00",
  "collectionMode": "derived-address",
  "expiresInMinutes": 60,
  "metadata": {
    "orderId": "order-99",
    "country": "BO"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `externalId` | string | Yes | Your idempotency key. Duplicate calls return the same pay-in. |
| `asset` | `USDC` \| `USDT` | Yes | Stablecoin to accept. |
| `amount` | string | Yes | Expected amount in human units (e.g. `"100.00"`). |
| `collectionMode` | `derived-address` \| `payment-router` | No | Default: `derived-address`. |
| `expiresInMinutes` | number | No | Overrides `defaultExpirationMinutes` from config. |
| `routerInvoiceId` | string | No | Custom invoice ID for `payment-router` mode. Auto-generated if omitted. |
| `metadata` | object | No | Arbitrary JSON stored with the record. |

**Response:**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "externalId": "invoice-2026-001",
  "status": "pending",
  "collectionMode": "derived-address",
  "depositAddress": "0xAbCd...1234",
  "derivationIndex": 42,
  "asset": "USDC",
  "expectedAmount": "100.00",
  "expectedAmountAtomic": "100000000",
  "receivedAmount": "0",
  "receivedAmountAtomic": "0",
  "sweepStatus": "pending",
  "expiresAt": "2026-06-09T11:00:00.000Z",
  "createdAt": "2026-06-09T10:00:00.000Z",
  "updatedAt": "2026-06-09T10:00:00.000Z",
  "detectedAt": null,
  "confirmedAt": null,
  "transfers": [],
  "auditTrail": []
}
```

**PaymentRouter mode:**

```json
{
  "externalId": "invoice-router-001",
  "asset": "USDC",
  "amount": "250.00",
  "collectionMode": "payment-router"
}
```

Returns `depositAddress` = PaymentRouter contract address and a `routerInvoiceId`. The payer must call `PaymentRouter.payInvoice(routerInvoiceId, USDC, amountAtomic, metadata)`.

---

### `GET /v1/payins`

List pay-ins with optional filters and pagination.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | PayInStatus | Filter by status |
| `externalId` | string | Exact match on external ID |
| `limit` | integer 1–1000 | Max records to return. Default: 100 |
| `offset` | integer ≥ 0 | Skip N records. Default: 0 |

```http
GET /v1/payins?status=confirmed&limit=20&offset=40
```

Returns array of pay-in objects ordered by `createdAt` descending.

---

### `GET /v1/payins/:id`

Get a single pay-in by UUID.

---

### `POST /v1/payins/:id/reconcile`

Scan Avalanche for transfers and update pay-in status.

- Scans ERC-20 `Transfer` logs (derived-address) or `InvoicePaid` events (payment-router).
- Fires `payin.detected` webhook on first transfer found.
- Fires `payin.confirmed` webhook when confirmation depth is reached.
- If `autoSweep: true`, triggers top-up and sweep automatically after confirmation.

No request body required.

**Status transitions:**

```
pending → detected   (funds seen, not enough confirmations)
pending → expired    (expiresAt passed, no funds)
detected → confirmed (enough confirmations, exact amount)
detected → underpaid (confirmed with less than expected)
detected → overpaid  (confirmed with more than expected)
```

---

### `POST /v1/payins/:id/accept`

Manually confirm an underpaid or overpaid pay-in.

```json
{
  "note": "Customer sent 99.50, accepted by ops team"
}
```

Sets `status = confirmed`, fires `payin.confirmed` webhook with `acceptedManually: true`.

---

### `POST /v1/payins/:id/topup`

Send AVAX from treasury to the derived deposit address to fund gas for the sweep.

```json
{
  "amountAvax": "0.002"
}
```

Default: `0.002 AVAX`. Only for `derived-address` pay-ins.

---

### `POST /v1/payins/:id/sweep`

Transfer ERC-20 balance from deposit address to institutional treasury.

```json
{
  "amount": "100.00",
  "notes": "Manual sweep after confirmation"
}
```

`amount` is optional — omit to sweep the full balance. Deposit address must have AVAX for gas (use `/topup` first).

Sets `sweepStatus`, `sweepTransactionHash`, `sweptAmount`.

---

### `POST /v1/payins/:id/topup-and-sweep`

Top-up AVAX + wait for receipt + sweep in a single call. Recommended for operator dashboards.

```json
{
  "amountAvax": "0.002",
  "notes": "Automated sweep"
}
```

---

## Hosted checkout (public)

A public, unauthenticated surface for browser-based payments. Each session is a PaymentRouter pay-in exposed through a **safe projection** — no client identity, no derivation index, no secrets. The session id (an unguessable UUID) is the capability, like a Stripe Checkout session.

These endpoints require **no API key**. Enabled by `AVASETTLE_CHECKOUT_DEMO_ENABLED` (default `true`); session creation requires `AVASETTLE_PAYMENT_ROUTER_ADDRESS` to be set (otherwise `503`).

### `GET /checkout/config`

Public configuration the checkout page needs to build a payment.

```json
{
  "network": "avalanche-fuji",
  "chainId": 43113,
  "networkName": "Avalanche Fuji Testnet",
  "explorerBaseUrl": "https://subnets-test.avax.network/c-chain",
  "demoEnabled": true,
  "router": { "address": "0xae77c3F3...6386f0", "configured": true },
  "token": { "symbol": "USDC", "address": "0x5425890298aed601595a70AB815c96711a31Bc65", "decimals": 6 }
}
```

### `POST /checkout/sessions`

Create an invoice anyone can pay. Returns the safe public projection.

```json
{ "amount": "25.00", "asset": "USDC", "reference": "Pedido #1234" }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | string | Yes | Invoice amount in human units. |
| `asset` | `USDC` \| `USDT` | No | Defaults to the first enabled asset. |
| `reference` | string | No | Human-readable label shown on the checkout (≤ 140 chars). |

**Response (public projection):**

```json
{
  "id": "9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10",
  "status": "pending",
  "asset": "USDC",
  "amount": "25.00",
  "amountAtomic": "25000000",
  "receivedAmount": "0",
  "network": "avalanche-fuji",
  "chainId": 43113,
  "tokenAddress": "0x5425890298aed601595a70AB815c96711a31Bc65",
  "routerAddress": "0xae77c3F3...6386f0",
  "invoiceId": "0x7aba3951...55ab6ed2",
  "reference": "Pedido #1234",
  "explorerBaseUrl": "https://subnets-test.avax.network/c-chain",
  "transactions": [],
  "createdAt": "2026-06-15T02:11:38.626Z",
  "expiresAt": null,
  "detectedAt": null,
  "confirmedAt": null
}
```

The payer's wallet approves the router for `amountAtomic`, then calls `PaymentRouter.payInvoice(invoiceId, tokenAddress, amountAtomic, "0x")`.

### `GET /checkout/sessions/:id`

Safe public status of an invoice (same projection). Poll this to track `pending → detected → confirmed`.

### `POST /checkout/sessions/:id/reconcile`

Re-scan the chain for this invoice on demand so the payer sees confirmation without waiting for the background reconcile loop. Returns the updated projection.

---

## Payouts

### `POST /v1/payouts`

Create a prepared payout. Does not broadcast. Validates amount, asset, and beneficiary address.

**Request:**

```json
{
  "externalId": "payout-2026-001",
  "asset": "USDC",
  "amount": "50.00",
  "beneficiaryAddress": "0x1111111111111111111111111111111111111111",
  "beneficiaryName": "Maria García",
  "memo": "Remittance BO",
  "metadata": {
    "country": "BO",
    "rail": "bank-transfer"
  }
}
```

| Field | Type | Required |
|---|---|---|
| `externalId` | string | Yes — idempotency key |
| `asset` | `USDC` \| `USDT` | Yes |
| `amount` | string | Yes — human units |
| `beneficiaryAddress` | `0x...` | Yes |
| `beneficiaryName` | string | No |
| `memo` | string | No |
| `metadata` | object | No |

Returns a payout record with `status: "prepared"`.

---

### `GET /v1/payouts`

List payouts with filters and pagination.

| Parameter | Type | Description |
|---|---|---|
| `status` | PayoutStatus | Filter by status |
| `externalId` | string | Exact match |
| `limit` | integer 1–1000 | Default: 100 |
| `offset` | integer ≥ 0 | Default: 0 |

---

### `GET /v1/payouts/:id`

Get payout detail including `transactionHash`, `failureReason`, and `auditTrail`.

---

### `POST /v1/payouts/:id/authorize`

Sign and broadcast the payout to Avalanche.

```json
{
  "approvedBy": "ops-team",
  "riskDecisionId": "risk-ok-0001",
  "notes": "Approved after compliance review"
}
```

Steps executed:
1. Marks payout `authorized`.
2. Reads treasury token balance.
3. Simulates the ERC-20 transfer.
4. Signs with `AVASETTLE_TREASURY_PRIVATE_KEY`.
5. Broadcasts to Avalanche.
6. Stores `transactionHash`, sets `status = broadcasted`.

Idempotent — returns existing payout if already broadcasted.

**Settlement rail.** When `AVASETTLE_SETTLEMENT_VAULT_ADDRESS` is set, the payout is executed through the on-chain **SettlementVault** instead of a direct treasury transfer: a hot **operator** key calls the vault, which pulls funds from the **funder** treasury (which only ever grants the vault an ERC-20 allowance). This separates the payout-execution key from fund custody. Without the vault configured, payouts use a direct transfer signed by the treasury key. The chosen rail is recorded on the audit event (`rail: "vault" | "direct"`).

---

### `POST /v1/payouts/batch-authorize`

Authorize many prepared payouts of the **same asset** and settle them in a **single atomic SettlementVault batch** — either every leg pays or the whole transaction reverts. Requires `AVASETTLE_SETTLEMENT_VAULT_ADDRESS`.

```json
{
  "payoutIds": ["7b4d9f4d-...", "8c5e0a5e-..."],
  "approvedBy": "ops-team",
  "notes": "Friday settlement run"
}
```

- Each payout is claimed `prepared → authorized` (guarded) before broadcasting, so it can't also be single-authorized concurrently.
- Validates: all ids exist, share one asset, are `prepared`, and the treasury (funder) holds enough balance. Max 256 per batch.
- A deterministic batch reference gives on-chain replay protection — re-submitting the same set can never double-pay.
- Returns the array of settled payouts (`broadcasted`/`confirmed`). On failure the whole batch reverts and every leg is reset (`prepared` for retryable allowance issues, otherwise `failed`).

---

### `POST /v1/payouts/:id/reconcile`

Check on-chain receipt and update payout status.

- No receipt yet → stays `broadcasted`
- Reverted → `failed`
- Confirmed with enough blocks → `confirmed`, fires `payout.confirmed` webhook

---

## Reconciliation

### `POST /v1/reconciliation/run` (admin)

Manually trigger reconciliation for all open payins and broadcasted payouts across every client. Requires the admin key.

Processes up to 10 records concurrently. Returns a summary:

```json
{
  "startedAt": "2026-06-09T10:00:00.000Z",
  "completedAt": "2026-06-09T10:00:05.234Z",
  "payinsChecked": 12,
  "payoutsChecked": 3,
  "results": [
    { "type": "payin", "id": "uuid", "status": "confirmed", "ok": true },
    { "type": "payout", "id": "uuid", "status": "confirmed", "ok": true }
  ]
}
```

Auto-reconciliation runs on a configurable interval (`autoReconcileIntervalSeconds`). Expired pending pay-ins are skipped — no RPC call is made for them.

---

## Treasury

### `GET /v1/treasury/status`

Returns operational configuration (no secrets).

```json
{
  "network": "avalanche-fuji",
  "chainId": 43113,
  "treasuryAddress": "0xAbCd...1234",
  "enabledAssets": ["USDC"],
  "assets": {
    "USDC": {
      "address": "0x5425890298aed601595a70AB815c96711a31Bc65",
      "decimals": 6,
      "maxPayoutAmount": "1000",
      "configured": true
    }
  },
  "minConfirmations": 2,
  "waitForReceipt": false,
  "mnemonicConfigured": true
}
```

### `GET /v1/treasury/balances`

Reads on-chain balances of the treasury wallet.

```json
{
  "address": "0xAbCd...1234",
  "network": "avalanche-fuji",
  "nativeBalance": "1.234567890",
  "nativeSymbol": "AVAX",
  "tokenBalances": {
    "USDC": "500.00"
  }
}
```

---

## Reports

### `GET /v1/reports/summary`

Aggregate counts and volumes.

```json
{
  "generatedAt": "2026-06-09T10:00:00.000Z",
  "payouts": {
    "count": 10,
    "byStatus": { "confirmed": 8, "broadcasted": 2 },
    "volumeByAsset": { "USDC": "3500.00" }
  },
  "payins": {
    "count": 25,
    "byStatus": { "confirmed": 20, "pending": 3, "expired": 2 },
    "byCollectionMode": { "derived-address": 20, "payment-router": 5 },
    "bySweepStatus": { "confirmed": 18, "pending": 2 },
    "expectedVolumeByAsset": { "USDC": "12500.00" },
    "receivedVolumeByAsset": { "USDC": "12480.00" },
    "sweptVolumeByAsset": { "USDC": "12480.00" }
  }
}
```

---

### `GET /v1/reports/sweep-queue` (admin)

Lists confirmed pay-ins whose sweep is still pending or failed. Use this as an operator dashboard for treasury consolidation.

```json
{
  "generatedAt": "2026-06-09T10:00:00.000Z",
  "count": 2,
  "items": [
    {
      "id": "uuid",
      "externalId": "invoice-001",
      "depositAddress": "0xAbCd...1234",
      "asset": "USDC",
      "receivedAmount": "100.00",
      "sweepStatus": "failed",
      "sweepFailureReason": "insufficient gas",
      "confirmedAt": "2026-06-09T09:30:00.000Z"
    }
  ]
}
```

---

### `GET /v1/reports/audit`

Export audit trail with filters.

| Parameter | Type | Description |
|---|---|---|
| `from` | ISO8601 | Start of date range |
| `to` | ISO8601 | End of date range |
| `subjectId` | string | Filter by pay-in or payout UUID |
| `limit` | integer 1–1000 | Default: 200 |

```http
GET /v1/reports/audit?from=2026-06-01T00:00:00Z&subjectId=uuid&limit=50
```

Returns events of types: `PAYIN_CREATED`, `PAYIN_RECONCILED`, `PAYIN_SWEPT`, `PAYIN_ACCEPTED`, `PAYIN_TOPUP`, `PAYOUT_CREATED`, `PAYOUT_AUTHORIZED`, `PAYOUT_RECONCILED`.

---

### `GET /v1/reports/webhook-deliveries`

Lists recent webhook delivery attempts. Requires PostgreSQL storage.

| Parameter | Type | Description |
|---|---|---|
| `limit` | integer 1–500 | Default: 50 |
| `failed` | boolean | `true` to show only failed deliveries |

```json
{
  "generatedAt": "2026-06-09T10:00:00.000Z",
  "count": 1,
  "items": [
    {
      "id": "uuid",
      "event": "payin.confirmed",
      "url": "https://your-endpoint.com/webhook",
      "success": false,
      "attempts": 3,
      "lastError": "HTTP 500",
      "deliveredAt": null,
      "createdAt": "2026-06-09T10:00:00.000Z"
    }
  ]
}
```

---

## Confidential settlements

Record an institutional settlement on-chain as a **hash commitment** — the amount and counterparty stay off the public ledger — with **selective disclosure** to a designated auditor. Backed by the `PrivateSettlementRegistry` contract; AvaSettle keeps the preimage so it can be revealed later. Requires `AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS` (plus a registrar key; reveal needs an auditor key).

> Experimental — the first step of AvaSettle's private-settlement roadmap toward encrypted ERC-20 (eERC). No tokens move here; only a commitment is published.

### `POST /v1/settlements`

```json
{
  "externalId": "settlement-2026-001",
  "asset": "USDC",
  "amount": "1500.00",
  "counterparty": "0x1111111111111111111111111111111111111111",
  "metadata": { "reference": "invoice-887" }
}
```

AvaSettle generates a random blinding `nonce`, computes `commitment = keccak256(amount, asset, counterparty, nonce)`, and publishes only the commitment on-chain. The response carries the commitment, `settlementId`, status, and the owner's own data — **never the nonce**. `externalId` is the idempotency key (bound into the on-chain `settlementId`).

### `GET /v1/settlements` · `GET /v1/settlements/:id`

List (newest first, `limit`/`offset`) or fetch the calling client's settlements.

### `POST /v1/settlements/:id/reveal`

The auditor attests on-chain that the record matches its preimage, leaving an immutable disclosure attestation (`status: revealed`). Requires `AVASETTLE_SETTLEMENT_AUDITOR_PRIVATE_KEY`.

---

## Chain Flow compatibility endpoints

These endpoints implement the exact Chain Flow PSP protocol for drop-in integration with existing Chain Flow orchestrators.

### `POST /api/prepararretiro`

Prepare a payout using the Chain Flow withdrawal payload.

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

Field mapping:

| Chain Flow field | AvaSettle field |
|---|---|
| `tcTransaccionExterna` | `externalId` |
| `tnMonto` | `amount` |
| `tnMoneda=1` | `asset=USDC` |
| `tnMoneda=2` | `asset=USDT` |
| `tcCuentaDestino` | `beneficiaryAddress` |


**Success response:**

```json
{
  "codigo": "00",
  "mensaje": "Retiro preparado.",
  "tcTransaccionExterna": "EXT-0001",
  "payoutId": "uuid",
  "estado": "prepared",
  "estadoChainFlow": "PREPARADO",
  "txHash": null
}
```

### `POST /api/autorizarretiro`

Authorize and broadcast a prepared payout.

```json
{ "tcTransaccionExterna": "EXT-0001" }
```

Accepts lookup by `payoutId`, `tcTransaccionExterna`, `externalId`, `tnRetiroPago`, or `tnTransferenciaBloque`.

### `GET /api/consultarestadoretiro`

Check payout status.

```http
GET /api/consultarestadoretiro?tcTransaccionExterna=EXT-0001
```

### `POST /api/consultarestadoretiro`

Same as GET but accepts JSON body — for orchestrators that standardize on POST.

---

## Webhook events

All payloads include `event` and `timestamp` fields.

### `payin.detected`

Fired when the first on-chain transfer to a deposit address is found. Payment not yet final.

```json
{
  "event": "payin.detected",
  "timestamp": "2026-06-09T10:05:00.000Z",
  "id": "uuid",
  "externalId": "invoice-001",
  "asset": "USDC",
  "depositAddress": "0xAbCd...1234",
  "receivedAmount": "100.00",
  "expectedAmount": "100.00",
  "detectedAt": "2026-06-09T10:05:00.000Z"
}
```

### `payin.confirmed`

Fired when a pay-in reaches confirmation depth, or when manually accepted.

```json
{
  "event": "payin.confirmed",
  "timestamp": "2026-06-09T10:06:30.000Z",
  "id": "uuid",
  "externalId": "invoice-001",
  "asset": "USDC",
  "receivedAmount": "100.00",
  "depositAddress": "0xAbCd...1234",
  "confirmedAt": "2026-06-09T10:06:30.000Z",
  "acceptedManually": false
}
```

### `payout.confirmed`

Fired when an outbound payout transaction is confirmed on-chain.

```json
{
  "event": "payout.confirmed",
  "timestamp": "2026-06-09T10:10:00.000Z",
  "id": "uuid",
  "externalId": "payout-001",
  "asset": "USDC",
  "amount": "50.00",
  "beneficiaryAddress": "0x1111111111111111111111111111111111111111",
  "transactionHash": "0xdeadbeef...",
  "confirmedAt": "2026-06-09T10:10:00.000Z"
}
```

**Signature verification:**

```http
x-avasettle-signature: sha256=<hmac-hex>
```

```javascript
import { createHmac } from 'node:crypto';

function verifyWebhook(rawBody, signatureHeader, secret) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  return expected === received;
}
```

---

## Status enumerations

### Pay-in statuses

| Status | Description |
|---|---|
| `pending` | Address issued, waiting for customer payment |
| `detected` | Funds seen on-chain, waiting for confirmations |
| `confirmed` | Exact amount received and finalized |
| `underpaid` | Customer sent less than expected |
| `overpaid` | Customer sent more than expected |
| `expired` | Expiration reached before any payment |

### Pay-in sweep statuses

| Status | Description |
|---|---|
| `pending` | Derived address not swept yet |
| `broadcasted` | Sweep transaction submitted, pending receipt |
| `confirmed` | Sweep confirmed (`waitForReceipt=true`) |
| `failed` | Sweep failed — usually insufficient AVAX for gas |
| `not_required` | PaymentRouter pay-in — funds went directly to treasury |

### Payout statuses

| Status | Description |
|---|---|
| `prepared` | Validated and stored, not broadcasted |
| `authorized` | Signing and broadcast initiated |
| `broadcasted` | Transaction hash exists, pending confirmation |
| `confirmed` | Transaction confirmed on-chain |
| `failed` | Transaction reverted or broadcast failed |

---

## Error responses

All errors use standard NestJS exception format:

```json
{
  "statusCode": 400,
  "message": "amount must be a positive decimal string",
  "error": "Bad Request"
}
```

| Status | Meaning |
|---|---|
| 400 | Validation error — check field formats |
| 401 | Missing or invalid API key |
| 404 | Record not found |
| 409 | Conflict — e.g., cannot sweep a non-confirmed pay-in |
| 429 | Rate limit exceeded (100 req/s per IP by default) |
| 503 | Service unavailable — e.g., mnemonic not configured |

---

## Configuration reference

All values can be set via env var or `config/avasettle.json`. Env vars take precedence.

| Env var | Config JSON path | Default | Description |
|---|---|---|---|
| `PORT` | `port` | `3001` | HTTP server port |
| `AVASETTLE_NETWORK` | `network` | `avalanche-fuji` | `avalanche-fuji` or `avalanche-mainnet` |
| `AVASETTLE_RPC_URL` | `rpcUrl` | Avalanche public RPC | Custom RPC endpoint |
| `AVASETTLE_EXPLORER_BASE_URL` | `explorerBaseUrl` | Snowtrace | Block explorer base URL |
| `AVASETTLE_CORS_ORIGINS` | `corsOrigins` | `*` | Comma-separated origins or `*` |
| `AVASETTLE_ADMIN_API_KEY` | — | — | **Secret.** Platform-operator key for client management |
| `AVASETTLE_TREASURY_PRIVATE_KEY` | — | — | **Secret.** Treasury hot wallet key |
| `AVASETTLE_PAYIN_MNEMONIC` | — | — | **Secret.** BIP-39 mnemonic for address derivation |
| `AVASETTLE_DATABASE_URL` | — | — | **Secret.** PostgreSQL connection string (required) |
| `AVASETTLE_DATABASE_SSL` | `database.ssl` | `false` | PostgreSQL TLS |
| `AVASETTLE_DATABASE_SSL_REJECT_UNAUTHORIZED` | `database.sslRejectUnauthorized` | `true` | Verify the server certificate |
| `AVASETTLE_DATABASE_MAX_CONNECTIONS` | `database.maxConnections` | `5` | pg pool size |
| `AVASETTLE_DATABASE_AUTO_MIGRATE` | `database.autoMigrate` | `true` | Run migrations on startup |
| `AVASETTLE_PAYIN_LOOKBACK_BLOCKS` | `payin.lookbackBlocks` | `50000` | Blocks scanned from `startBlock` |
| `AVASETTLE_PAYIN_DERIVATION_ACCOUNT` | `payin.derivationAccount` | `0` | BIP-44 account index |
| `AVASETTLE_PAYIN_DEFAULT_EXPIRATION_MINUTES` | `payin.defaultExpirationMinutes` | `null` | Default expiry if not specified per-request |
| `AVASETTLE_PAYMENT_ROUTER_ADDRESS` | `payin.paymentRouterAddress` | `null` | Deployed PaymentRouter contract |
| `AVASETTLE_ENABLED_ASSETS` | `assets.enabled` | `USDC` | Comma-separated: `USDC,USDT` |
| `AVASETTLE_USDC_ADDRESS` | `assets.USDC.address` | — | USDC contract address on selected network |
| `AVASETTLE_USDC_DECIMALS` | `assets.USDC.decimals` | `6` | Token decimals |
| `AVASETTLE_MAX_PAYOUT_USDC` | `assets.USDC.maxPayoutAmount` | — | Max per-payout policy |
| `AVASETTLE_USDT_ADDRESS` | `assets.USDT.address` | — | USDT contract address |
| `AVASETTLE_USDT_DECIMALS` | `assets.USDT.decimals` | `6` | |
| `AVASETTLE_MAX_PAYOUT_USDT` | `assets.USDT.maxPayoutAmount` | — | |
| `AVASETTLE_MIN_CONFIRMATIONS` | `blockchain.minConfirmations` | `2` | Blocks after transfer before `confirmed` |
| `AVASETTLE_WAIT_FOR_RECEIPT` | `blockchain.waitForReceipt` | `false` | Wait for receipt before returning txHash |
| `AVASETTLE_WEBHOOK_RETRY_ATTEMPTS` | `webhook.retryAttempts` | `3` | Max delivery attempts per event (delays: 1s, 5s, 30s) |
| `AVASETTLE_WEBHOOK_DISPATCH_INTERVAL_SECONDS` | `webhook.dispatchIntervalSeconds` | `5` | Outbox drain interval; `0` disables the dispatcher |
| `AVASETTLE_AUTO_RECONCILE_INTERVAL_SECONDS` | `autoReconcileIntervalSeconds` | `null` | Enable auto-reconciliation (min: 10s) |
| `AVASETTLE_AUTO_SWEEP` | `autoSweep` | `false` | Auto topup+sweep after pay-in confirmation |
| `AVASETTLE_THROTTLE_RPS` | `throttleRps` | `100` | Rate limit per API key (fallback: per IP), in-memory |
| `AVASETTLE_TRUST_PROXY` | `trustProxy` | `false` | Express trust-proxy setting (hops, true, or CIDR) for real client IPs behind a LB |
| `LOGGING_WIPED_KEYS` | — | See defaults | Comma-separated extra keys to wipe from logs |
| `LOGGING_PROTECTED_KEYS` | — | See defaults | Comma-separated extra keys to partially mask |

---

## Integration walkthrough: pay-in flow

```
1. Your backend calls POST /v1/payins
   → AvaSettle returns depositAddress (unique per invoice)

2. You display depositAddress to your customer

3. Customer sends USDC to depositAddress

4. AvaSettle reconciliation detects the transfer
   → Fires payin.detected webhook to your server

5. After minConfirmations blocks
   → payin.confirmed webhook fires
   → If autoSweep=true, funds move to treasury automatically

6. If autoSweep=false, call POST /v1/payins/:id/topup-and-sweep
   → Treasury tops up AVAX, then sweeps USDC to treasury wallet
```

## Integration walkthrough: payout flow

```
1. Your backend calls POST /v1/payouts with beneficiary address and amount
   → Returns payoutId with status=prepared

2. After compliance/approval, call POST /v1/payouts/:id/authorize
   → AvaSettle signs and broadcasts the ERC-20 transfer
   → Returns transactionHash with status=broadcasted

3. Reconciliation auto-runs (or call POST /v1/payouts/:id/reconcile)
   → When confirmed: payout.confirmed webhook fires
```
