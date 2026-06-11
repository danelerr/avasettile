/**
 * Integration tests against a real PostgreSQL instance.
 *
 * They run automatically in CI (postgres service container). Locally they are
 * skipped unless AVASETTLE_DATABASE_URL / DATABASE_URL points to a database —
 * the schema is migrated and operational tables are TRUNCATED, so never point
 * this at a database whose data you care about.
 */
import { randomUUID } from 'node:crypto';
import { ClientsRepository } from '../src/clients/clients.repository';
import { ClientsService } from '../src/clients/clients.service';
import { ConfigurationService } from '../src/configuration/configuration.service';
import { DatabaseService } from '../src/database/database.service';
import { PayInLedgerService } from '../src/payins/payin-ledger.service';
import {
  PayInCollectionMode,
  PayInRecord,
  PayInStatus,
  PayInSweepStatus,
} from '../src/payins/payins.types';
import { PayoutLedgerService } from '../src/payouts/payout-ledger.service';
import { PayoutRecord, PayoutStatus } from '../src/payouts/payout.types';
import { WebhookService } from '../src/webhooks/webhook.service';
import type { OutboundHttpLogger } from '../src/observability/outbound-http-logger';

const hasDatabase = Boolean(
  process.env.AVASETTLE_DATABASE_URL ?? process.env.DATABASE_URL,
);
const describeWithDb = hasDatabase ? describe : describe.skip;

function payinFixture(overrides: Partial<PayInRecord> = {}): PayInRecord {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    clientId: null,
    externalId: `payin-${randomUUID()}`,
    chainFlowRequestId: null,
    status: PayInStatus.Pending,
    network: 'avalanche-fuji',
    chainId: 43113,
    asset: 'USDC',
    tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
    expectedAmount: '10',
    expectedAmountAtomic: '10000000',
    receivedAmount: '0',
    receivedAmountAtomic: '0',
    depositAddress: '0x1111111111111111111111111111111111111111',
    derivationIndex: 0,
    collectionMode: PayInCollectionMode.DerivedAddress,
    routerAddress: null,
    routerInvoiceId: null,
    startBlock: '1',
    lastScannedBlock: null,
    expiresAt: null,
    metadata: {},
    transfers: [],
    sweepStatus: PayInSweepStatus.Pending,
    sweepTransactionHash: null,
    sweptAmount: '0',
    sweptAmountAtomic: '0',
    sweptAt: null,
    sweepFailureReason: null,
    createdAt: now,
    updatedAt: now,
    detectedAt: null,
    confirmedAt: null,
    acceptedAt: null,
    acceptanceNote: null,
    ...overrides,
  };
}

function payoutFixture(overrides: Partial<PayoutRecord> = {}): PayoutRecord {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    clientId: null,
    externalId: `payout-${randomUUID()}`,
    chainFlowRequestId: null,
    status: PayoutStatus.Prepared,
    network: 'avalanche-fuji',
    chainId: 43113,
    asset: 'USDC',
    tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
    amount: '10',
    amountAtomic: '10000000',
    beneficiaryAddress: '0x1111111111111111111111111111111111111111',
    beneficiaryName: null,
    treasuryAddress: null,
    transactionHash: null,
    failureReason: null,
    memo: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    authorizedAt: null,
    broadcastedAt: null,
    confirmedAt: null,
    ...overrides,
  };
}

describeWithDb('PostgreSQL repositories (integration)', () => {
  let database: DatabaseService;
  let clientsRepository: ClientsRepository;
  let clientsService: ClientsService;
  let payins: PayInLedgerService;
  let payouts: PayoutLedgerService;
  let clientA: string;
  let clientB: string;

  beforeAll(async () => {
    database = new DatabaseService(new ConfigurationService());
    await database.runMigrations();
    await database.query(
      `TRUNCATE avasettle_payins, avasettle_payouts, avasettle_audit_events,
               avasettle_idempotency_keys, avasettle_webhook_outbox,
               avasettle_webhook_deliveries, avasettle_clients CASCADE`,
    );

    clientsRepository = new ClientsRepository(database);
    clientsService = new ClientsService(clientsRepository);
    payins = new PayInLedgerService(database);
    payouts = new PayoutLedgerService(database);

    clientA = (await clientsService.createClient({ name: 'Client A' })).id;
    clientB = (await clientsService.createClient({ name: 'Client B' })).id;
  });

  afterAll(async () => {
    await database.onModuleDestroy();
  });

  describe('clients', () => {
    it('resolves a freshly issued key and rejects it after rotation', async () => {
      const created = await clientsService.createClient({ name: 'Rotating' });

      const resolved = await clientsService.resolveActiveClientByApiKey(
        created.apiKey,
      );
      expect(resolved?.id).toBe(created.id);

      const rotated = await clientsService.rotateApiKey(created.id);
      expect(rotated.apiKey).not.toBe(created.apiKey);

      await expect(
        clientsService.resolveActiveClientByApiKey(created.apiKey),
      ).resolves.toBeNull();
      await expect(
        clientsService.resolveActiveClientByApiKey(rotated.apiKey),
      ).resolves.toMatchObject({ id: created.id });
    });

    it('stops resolving keys of disabled clients', async () => {
      const created = await clientsService.createClient({ name: 'Disabled' });
      await clientsService.updateClient(created.id, { status: 'disabled' });

      await expect(
        clientsService.resolveActiveClientByApiKey(created.apiKey),
      ).resolves.toBeNull();
    });
  });

  describe('pay-in ledger', () => {
    it('is idempotent per (client, externalId) and isolated across clients', async () => {
      const externalId = `shared-${randomUUID()}`;

      const first = await payins.createOrGetExisting(
        payinFixture({ clientId: clientA, externalId }),
      );
      const replay = await payins.createOrGetExisting(
        payinFixture({ clientId: clientA, externalId }),
      );
      const otherTenant = await payins.createOrGetExisting(
        payinFixture({ clientId: clientB, externalId }),
      );

      expect(first.existed).toBe(false);
      expect(replay.existed).toBe(true);
      expect(replay.record.id).toBe(first.record.id);
      expect(otherTenant.existed).toBe(false);
      expect(otherTenant.record.id).not.toBe(first.record.id);

      // Scoped lookups never leak across tenants.
      await expect(
        payins.findById(first.record.id, clientB),
      ).resolves.toBeNull();
      await expect(
        payins.findById(first.record.id, clientA),
      ).resolves.toMatchObject({ id: first.record.id });
    });

    it('only applies guarded updates from the expected status', async () => {
      const { record } = await payins.createOrGetExisting(
        payinFixture({ clientId: clientA, status: PayInStatus.Underpaid }),
      );

      const accepted = await payins.update(
        record.id,
        { status: PayInStatus.Confirmed },
        { expectedStatus: [PayInStatus.Underpaid, PayInStatus.Overpaid] },
      );
      expect(accepted?.status).toBe(PayInStatus.Confirmed);

      // Second accept loses the race: the row is no longer underpaid.
      const replay = await payins.update(
        record.id,
        { status: PayInStatus.Confirmed },
        { expectedStatus: [PayInStatus.Underpaid, PayInStatus.Overpaid] },
      );
      expect(replay).toBeNull();
    });

    it('namespaces idempotency keys per client', async () => {
      const key = `idem-${randomUUID()}`;
      const recordA = (
        await payins.createOrGetExisting(payinFixture({ clientId: clientA }))
      ).record;

      await payins.storeIdempotencyKey(clientA, key, recordA.id);

      await expect(
        payins.findByIdempotencyKey(clientA, key),
      ).resolves.toMatchObject({ id: recordA.id });
      await expect(
        payins.findByIdempotencyKey(clientB, key),
      ).resolves.toBeNull();
    });
  });

  describe('payout ledger', () => {
    it('lets exactly one of two concurrent authorizations claim the payout', async () => {
      const { record } = await payouts.createOrGetExisting(
        payoutFixture({ clientId: clientA }),
      );

      const claim = {
        status: PayoutStatus.Authorized,
        authorizedAt: new Date().toISOString(),
      };
      const guard = { expectedStatus: [PayoutStatus.Prepared] };

      const [first, second] = await Promise.all([
        payouts.update(record.id, claim, guard),
        payouts.update(record.id, claim, guard),
      ]);

      const winners = [first, second].filter((result) => result !== null);
      expect(winners).toHaveLength(1);
      expect(winners[0]?.status).toBe(PayoutStatus.Authorized);
    });
  });

  describe('webhook outbox', () => {
    function buildWebhookService(http: { fetch: jest.Mock }): WebhookService {
      return new WebhookService(
        clientsRepository,
        new ConfigurationService(),
        database,
        http as unknown as OutboundHttpLogger,
      );
    }

    it('enqueues, delivers, and logs the delivery', async () => {
      const client = await clientsService.createClient({
        name: 'Hooked',
        webhookUrl: 'https://example.com/webhook',
        webhookSecret: 'secret',
      });
      const http = {
        fetch: jest.fn().mockResolvedValue({ ok: true, status: 200 }),
      };
      const webhooks = buildWebhookService(http);

      await webhooks.enqueue(client.id, 'payin.confirmed', { amount: '10' });
      const processed = await webhooks.dispatchDueEvents();

      expect(processed).toBe(1);
      expect(http.fetch).toHaveBeenCalledTimes(1);
      const [, options] = http.fetch.mock.calls[0] as [
        string,
        { headers: Record<string, string>; body: string },
      ];
      expect(options.headers['x-avasettle-signature']).toMatch(/^sha256=/);

      const outbox = await database.query<{ status: string }>(
        'SELECT status FROM avasettle_webhook_outbox WHERE client_id = $1',
        [client.id],
      );
      expect(outbox.rows[0].status).toBe('delivered');

      const deliveries = await webhooks.listRecentDeliveries(client.id, 10);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].success).toBe(true);
    });

    it('marks non-retryable failures as failed with a delivery log entry', async () => {
      const client = await clientsService.createClient({
        name: 'Rejected',
        webhookUrl: 'https://example.com/webhook',
      });
      const http = {
        fetch: jest.fn().mockResolvedValue({ ok: false, status: 400 }),
      };
      const webhooks = buildWebhookService(http);

      await webhooks.enqueue(client.id, 'payout.confirmed', {});
      await webhooks.dispatchDueEvents();

      const outbox = await database.query<{
        status: string;
        last_error: string;
      }>(
        'SELECT status, last_error FROM avasettle_webhook_outbox WHERE client_id = $1',
        [client.id],
      );
      expect(outbox.rows[0].status).toBe('failed');
      expect(outbox.rows[0].last_error).toBe('HTTP 400');

      const deliveries = await webhooks.listRecentDeliveries(
        client.id,
        10,
        true,
      );
      expect(deliveries).toHaveLength(1);
    });

    it('skips clients without a webhook endpoint', async () => {
      const client = await clientsService.createClient({ name: 'No hook' });
      const http = { fetch: jest.fn() };
      const webhooks = buildWebhookService(http);

      await webhooks.enqueue(client.id, 'payin.detected', {});
      await webhooks.dispatchDueEvents();

      expect(http.fetch).not.toHaveBeenCalled();
      const outbox = await database.query<{ status: string }>(
        'SELECT status FROM avasettle_webhook_outbox WHERE client_id = $1',
        [client.id],
      );
      expect(outbox.rows[0].status).toBe('skipped');
    });
  });

  describe('derivation counter', () => {
    it('hands out strictly increasing indexes under concurrency', async () => {
      const claims = await Promise.all(
        Array.from({ length: 10 }, () => database.claimNextPayInIndex()),
      );
      expect(new Set(claims).size).toBe(10);
    });
  });
});
