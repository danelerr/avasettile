import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AVASETTLE_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.AVASETTLE_STORAGE_DRIVER;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not require PostgreSQL when the storage driver is json', async () => {
    const service = new DatabaseService(new ConfigurationService());

    await expect(service.getReadiness()).resolves.toMatchObject({
      driver: 'json',
      configured: false,
      reachable: true,
      required: false,
    });
  });

  it('reports degraded readiness when postgres storage is selected without a URL', async () => {
    process.env.AVASETTLE_STORAGE_DRIVER = 'postgres';
    const service = new DatabaseService(new ConfigurationService());

    await expect(service.getReadiness()).resolves.toMatchObject({
      driver: 'postgres',
      configured: false,
      reachable: false,
      required: true,
    });
  });
});
