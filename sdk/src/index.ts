import type {
  AuthorizePayoutInput,
  BatchAuthorizePayoutInput,
  CheckoutConfig,
  CheckoutSession,
  Client,
  ClientWithApiKey,
  CreateCheckoutSessionInput,
  CreateClientInput,
  CreatePayInInput,
  CreatePayoutInput,
  CreateSettlementInput,
  ListPayInsQuery,
  ListPayoutsQuery,
  PayIn,
  Payout,
  PrivateSettlement,
  Readiness,
  TreasuryBalances,
  TreasuryStatus,
  UpdateClientInput,
} from './types.js';

export * from './types.js';

/** Thrown for any non-2xx response. Carries the HTTP status and parsed body. */
export class AvaSettleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'AvaSettleApiError';
  }
}

export interface AvaSettleClientOptions {
  /** e.g. https://api.avasettle.com or http://localhost:3001 */
  baseUrl: string;
  /** Client key (`avk_…`) or the platform admin key, per the endpoint. */
  apiKey: string;
  /** Override the global fetch (e.g. on older Node, pass node-fetch). */
  fetch?: typeof fetch;
}

interface RequestInit_ {
  body?: unknown;
  query?: object;
  /** Set false for the public checkout endpoints (no API key sent). */
  auth?: boolean;
}

/**
 * Typed client for the AvaSettle API. One instance is bound to one API key;
 * use a client key for business endpoints and the admin key for `clients`.
 */
export class AvaSettleClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AvaSettleClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    const f = options.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error(
        'No fetch implementation available; pass options.fetch (e.g. node-fetch).',
      );
    }
    this.fetchImpl = f;
  }

  private async request<T>(
    method: string,
    path: string,
    init: RequestInit_ = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.auth !== false) headers['x-avasettle-api-key'] = this.apiKey;
    if (init.body !== undefined) headers['content-type'] = 'application/json';

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      throw new AvaSettleApiError(
        response.status,
        extractMessage(data) ?? response.statusText,
        data,
      );
    }
    return data as T;
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  readonly health = {
    metadata: () => this.request<Record<string, unknown>>('GET', '/', { auth: false }),
    live: () =>
      this.request<{ status: string }>('GET', '/health', { auth: false }),
    ready: () =>
      this.request<Readiness>('GET', '/health/readiness', { auth: false }),
  };

  // ── Pay-ins ──────────────────────────────────────────────────────────────────

  readonly payins = {
    create: (input: CreatePayInInput) =>
      this.request<PayIn>('POST', '/v1/payins', { body: input }),
    list: (query?: ListPayInsQuery) =>
      this.request<PayIn[]>('GET', '/v1/payins', { query }),
    get: (id: string) => this.request<PayIn>('GET', `/v1/payins/${enc(id)}`),
    reconcile: (id: string) =>
      this.request<PayIn>('POST', `/v1/payins/${enc(id)}/reconcile`),
    sweep: (id: string, body?: { amount?: string; notes?: string }) =>
      this.request<PayIn>('POST', `/v1/payins/${enc(id)}/sweep`, { body: body ?? {} }),
    accept: (id: string, body?: { note?: string }) =>
      this.request<PayIn>('POST', `/v1/payins/${enc(id)}/accept`, { body: body ?? {} }),
    topUp: (id: string, body?: { amountAvax?: string }) =>
      this.request<PayIn>('POST', `/v1/payins/${enc(id)}/topup`, { body: body ?? {} }),
    topUpAndSweep: (id: string, body?: { amountAvax?: string; notes?: string }) =>
      this.request<PayIn>('POST', `/v1/payins/${enc(id)}/topup-and-sweep`, {
        body: body ?? {},
      }),
  };

  // ── Payouts ──────────────────────────────────────────────────────────────────

  readonly payouts = {
    create: (input: CreatePayoutInput) =>
      this.request<Payout>('POST', '/v1/payouts', { body: input }),
    list: (query?: ListPayoutsQuery) =>
      this.request<Payout[]>('GET', '/v1/payouts', { query }),
    get: (id: string) => this.request<Payout>('GET', `/v1/payouts/${enc(id)}`),
    authorize: (id: string, input: AuthorizePayoutInput = {}) =>
      this.request<Payout>('POST', `/v1/payouts/${enc(id)}/authorize`, { body: input }),
    /** Atomic batch settlement via the SettlementVault. */
    authorizeBatch: (input: BatchAuthorizePayoutInput) =>
      this.request<Payout[]>('POST', '/v1/payouts/batch-authorize', { body: input }),
    reconcile: (id: string) =>
      this.request<Payout>('POST', `/v1/payouts/${enc(id)}/reconcile`),
  };

  // ── Clients (platform admin key) ─────────────────────────────────────────────

  readonly clients = {
    create: (input: CreateClientInput) =>
      this.request<ClientWithApiKey>('POST', '/v1/admin/clients', { body: input }),
    list: () => this.request<Client[]>('GET', '/v1/admin/clients'),
    get: (id: string) => this.request<Client>('GET', `/v1/admin/clients/${enc(id)}`),
    update: (id: string, input: UpdateClientInput) =>
      this.request<Client>('PATCH', `/v1/admin/clients/${enc(id)}`, { body: input }),
    rotateKey: (id: string) =>
      this.request<ClientWithApiKey>('POST', `/v1/admin/clients/${enc(id)}/rotate-key`),
  };

  // ── Treasury ───────────────────────────────────────────────────────────────

  readonly treasury = {
    status: () => this.request<TreasuryStatus>('GET', '/v1/treasury/status'),
    balances: () => this.request<TreasuryBalances>('GET', '/v1/treasury/balances'),
  };

  // ── Reports ────────────────────────────────────────────────────────────────

  readonly reports = {
    summary: () =>
      this.request<Record<string, unknown>>('GET', '/v1/reports/summary'),
    /** Admin key required. */
    sweepQueue: () =>
      this.request<Record<string, unknown>>('GET', '/v1/reports/sweep-queue'),
    webhookDeliveries: (query?: { failed?: boolean; limit?: number }) =>
      this.request<Record<string, unknown>>('GET', '/v1/reports/webhook-deliveries', {
        query,
      }),
    audit: (query?: {
      subjectId?: string;
      from?: string;
      to?: string;
      limit?: number;
    }) => this.request<unknown[]>('GET', '/v1/reports/audit', { query }),
  };

  // ── Hosted checkout (public, no API key) ─────────────────────────────────────

  readonly checkout = {
    config: () =>
      this.request<CheckoutConfig>('GET', '/checkout/config', { auth: false }),
    createSession: (input: CreateCheckoutSessionInput) =>
      this.request<CheckoutSession>('POST', '/checkout/sessions', {
        body: input,
        auth: false,
      }),
    getSession: (id: string) =>
      this.request<CheckoutSession>('GET', `/checkout/sessions/${enc(id)}`, {
        auth: false,
      }),
    reconcileSession: (id: string) =>
      this.request<CheckoutSession>(
        'POST',
        `/checkout/sessions/${enc(id)}/reconcile`,
        { auth: false },
      ),
  };

  // ── Confidential settlements ─────────────────────────────────────────────────

  readonly settlements = {
    record: (input: CreateSettlementInput) =>
      this.request<PrivateSettlement>('POST', '/v1/settlements', { body: input }),
    list: (query?: { limit?: number; offset?: number }) =>
      this.request<PrivateSettlement[]>('GET', '/v1/settlements', { query }),
    get: (id: string) =>
      this.request<PrivateSettlement>('GET', `/v1/settlements/${enc(id)}`),
    reveal: (id: string) =>
      this.request<PrivateSettlement>('POST', `/v1/settlements/${enc(id)}/reveal`),
  };
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

function extractMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return undefined;
}
