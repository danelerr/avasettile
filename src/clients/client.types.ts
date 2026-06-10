export type ClientStatus = 'active' | 'disabled';

export type ClientRecord = {
  id: string;
  name: string;
  status: ClientStatus;
  apiKeyPrefix: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Public shape returned by the admin API — never exposes webhook secrets. */
export type ClientResponse = Omit<ClientRecord, 'webhookSecret'> & {
  webhookSecretConfigured: boolean;
};

/** Returned only once, when a client is created or its key is rotated. */
export type ClientWithApiKey = ClientResponse & {
  apiKey: string;
};
