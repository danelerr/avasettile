import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AVASETTLE_DATABASE_URL;
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports unconfigured readiness without a database URL', async () => {
    const service = new DatabaseService(new ConfigurationService());

    await expect(service.getReadiness()).resolves.toMatchObject({
      configured: false,
      reachable: false,
    });
  });

  it('rejects queries when PostgreSQL is not configured', async () => {
    const service = new DatabaseService(new ConfigurationService());

    await expect(service.claimNextPayInIndex()).rejects.toThrow(
      'PostgreSQL is not configured',
    );
  });
});
