# @avasettle/sdk

TypeScript SDK for the [AvaSettle](../README.md) API — multi-tenant stablecoin
settlement on Avalanche. Fully typed, zero runtime dependencies (uses the
platform `fetch`).

## Install

```bash
npm install @avasettle/sdk
```

> Node 18+ (built-in `fetch`). On older runtimes pass a `fetch` implementation
> via `options.fetch`.

## Quick start

```ts
import { AvaSettleClient } from '@avasettle/sdk';

const ava = new AvaSettleClient({
  baseUrl: 'https://api.avasettle.com',
  apiKey: process.env.AVASETTLE_API_KEY!, // your client key (avk_…)
});

// Create a pay-in and show the deposit address to your customer.
const payin = await ava.payins.create({
  externalId: 'invoice-2026-001',
  asset: 'USDC',
  amount: '100.00',
});
console.log(payin.depositAddress, payin.status);

// Later: reconcile and read status.
const reconciled = await ava.payins.reconcile(payin.id);
```

## Resources

| Namespace | Methods |
|---|---|
| `ava.payins` | `create` · `list` · `get` · `reconcile` · `sweep` · `accept` · `topUp` · `topUpAndSweep` |
| `ava.payouts` | `create` · `list` · `get` · `authorize` · `authorizeBatch` · `reconcile` |
| `ava.checkout` | `config` · `createSession` · `getSession` · `reconcileSession` *(public, no key)* |
| `ava.settlements` | `record` · `list` · `get` · `reveal` |
| `ava.treasury` | `status` · `balances` |
| `ava.reports` | `summary` · `sweepQueue` · `webhookDeliveries` · `audit` |
| `ava.clients` | `create` · `list` · `get` · `update` · `rotateKey` *(admin key)* |
| `ava.health` | `metadata` · `live` · `ready` |

## Authentication

One client instance is bound to one API key. Use a **client key** (`avk_…`) for
business endpoints, and the **platform admin key** for `ava.clients.*`. The
hosted-checkout endpoints are public and send no key.

```ts
const admin = new AvaSettleClient({ baseUrl, apiKey: process.env.AVASETTLE_ADMIN_API_KEY! });
const { id, apiKey } = await admin.clients.create({ name: 'Fintech LATAM SA' });
// apiKey is shown once — store it securely.
```

## Errors

Any non-2xx response throws `AvaSettleApiError` with the HTTP `status` and parsed
`body`:

```ts
import { AvaSettleApiError } from '@avasettle/sdk';

try {
  await ava.payouts.authorize(id);
} catch (err) {
  if (err instanceof AvaSettleApiError) {
    console.error(err.status, err.message); // e.g. 409 "Insufficient treasury USDC balance."
  }
}
```

## Atomic batch payouts

When the SettlementVault is configured server-side, settle many payouts in one
atomic transaction:

```ts
await ava.payouts.authorizeBatch({
  payoutIds: [p1.id, p2.id, p3.id],
  approvedBy: 'ops-team',
});
```
