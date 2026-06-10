import { createHash } from 'node:crypto';
import { ClientRecord } from './client.types';
import { ClientsRepository } from './clients.repository';
import { ClientsService, hashApiKey } from './clients.service';

describe('ClientsService', () => {
  const repository = {
    insert: jest.fn(),
    findById: jest.fn(),
    findActiveByApiKeyHash: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    rotateApiKey: jest.fn(),
  };

  let service: ClientsService;

  const storedClient = (
    overrides: Partial<ClientRecord> = {},
  ): ClientRecord => ({
    id: 'client-1',
    name: 'Fintech LATAM SA',
    status: 'active',
    apiKeyPrefix: 'avk_12345678',
    webhookUrl: null,
    webhookSecret: 'hook-secret',
    metadata: {},
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ClientsService(repository as unknown as ClientsRepository);
  });

  it('creates a client, persists only the key hash, and returns the key once', async () => {
    repository.insert.mockImplementation((input: { apiKeyPrefix: string }) =>
      Promise.resolve(storedClient({ apiKeyPrefix: input.apiKeyPrefix })),
    );

    const created = await service.createClient({ name: 'Fintech LATAM SA' });

    expect(created.apiKey).toMatch(/^avk_[0-9a-f]{48}$/);
    expect(created.apiKeyPrefix).toBe(created.apiKey.slice(0, 12));

    const calls = repository.insert.mock.calls as [[{ apiKeyHash: string }]];
    const inserted = calls[0][0];
    expect(inserted.apiKeyHash).toBe(
      createHash('sha256').update(created.apiKey).digest('hex'),
    );
    // The persisted shape never contains the plaintext key.
    expect(JSON.stringify(inserted)).not.toContain(created.apiKey);
  });

  it('never exposes the webhook secret in responses', async () => {
    repository.findById.mockResolvedValue(storedClient());

    const client = await service.getClient('client-1');

    expect(client).not.toHaveProperty('webhookSecret');
    expect(client.webhookSecretConfigured).toBe(true);
  });

  it('resolves active clients by hashed API key', async () => {
    repository.findActiveByApiKeyHash.mockResolvedValue(storedClient());

    await service.resolveActiveClientByApiKey('avk_abc');

    expect(repository.findActiveByApiKeyHash).toHaveBeenCalledWith(
      hashApiKey('avk_abc'),
    );
  });
});
