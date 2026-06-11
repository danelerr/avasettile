import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ClientRecord, ClientResponse, ClientWithApiKey } from './client.types';
import { ClientsRepository } from './clients.repository';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const API_KEY_PREFIX = 'avk_';

// Per-request key resolution hits this cache before PostgreSQL. Kept short so
// a disable/rotation propagates to other instances within one TTL.
const API_KEY_CACHE_TTL_MS = 30_000;

@Injectable()
export class ClientsService {
  private readonly apiKeyCache = new Map<
    string,
    { client: ClientRecord; expiresAt: number }
  >();

  constructor(private readonly repository: ClientsRepository) {}

  async createClient(dto: CreateClientDto): Promise<ClientWithApiKey> {
    const { apiKey, apiKeyHash, apiKeyPrefix } = this.generateApiKey();
    const client = await this.repository.insert({
      id: randomUUID(),
      name: dto.name,
      apiKeyHash,
      apiKeyPrefix,
      webhookUrl: dto.webhookUrl ?? null,
      webhookSecret: dto.webhookSecret ?? null,
      metadata: dto.metadata ?? {},
    });

    return { ...this.toResponse(client), apiKey };
  }

  async listClients(): Promise<ClientResponse[]> {
    const clients = await this.repository.list();
    return clients.map((client) => this.toResponse(client));
  }

  async getClient(id: string): Promise<ClientResponse> {
    return this.toResponse(await this.requireClient(id));
  }

  async updateClient(
    id: string,
    dto: UpdateClientDto,
  ): Promise<ClientResponse> {
    await this.requireClient(id);
    const updated = await this.repository.update(id, {
      name: dto.name,
      status: dto.status,
      webhookUrl: dto.webhookUrl,
      webhookSecret: dto.webhookSecret,
      metadata: dto.metadata,
    });
    if (!updated) throw new NotFoundException('Client not found.');
    this.apiKeyCache.clear();
    return this.toResponse(updated);
  }

  async rotateApiKey(id: string): Promise<ClientWithApiKey> {
    await this.requireClient(id);
    const { apiKey, apiKeyHash, apiKeyPrefix } = this.generateApiKey();
    const updated = await this.repository.rotateApiKey(
      id,
      apiKeyHash,
      apiKeyPrefix,
    );
    if (!updated) throw new NotFoundException('Client not found.');
    this.apiKeyCache.clear();
    return { ...this.toResponse(updated), apiKey };
  }

  async resolveActiveClientByApiKey(
    apiKey: string,
  ): Promise<ClientRecord | null> {
    const hash = hashApiKey(apiKey);

    const cached = this.apiKeyCache.get(hash);
    if (cached && cached.expiresAt > Date.now()) return cached.client;

    const client = await this.repository.findActiveByApiKeyHash(hash);
    if (client) {
      this.apiKeyCache.set(hash, {
        client,
        expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
      });
    } else {
      this.apiKeyCache.delete(hash);
    }
    return client;
  }

  private async requireClient(id: string): Promise<ClientRecord> {
    const client = await this.repository.findById(id);
    if (!client) throw new NotFoundException('Client not found.');
    return client;
  }

  private generateApiKey(): {
    apiKey: string;
    apiKeyHash: string;
    apiKeyPrefix: string;
  } {
    const apiKey = `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
    return {
      apiKey,
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: apiKey.slice(0, API_KEY_PREFIX.length + 8),
    };
  }

  private toResponse(client: ClientRecord): ClientResponse {
    const { webhookSecret, ...rest } = client;
    return { ...rest, webhookSecretConfigured: Boolean(webhookSecret) };
  }
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
