// Boot the app with a dummy database URL: GET / never touches PostgreSQL,
// and auto-migrate is disabled so module init does not try to connect.
process.env.AVASETTLE_DATABASE_URL =
  process.env.AVASETTLE_DATABASE_URL ??
  'postgres://avasettle:avasettle@localhost:5432/avasettle_e2e';
process.env.AVASETTLE_DATABASE_AUTO_MIGRATE = 'false';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    const server = app.getHttpAdapter().getInstance() as App;

    return request(server)
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          product: 'AvaSettle',
          role: 'avalanche-on-chain-provider',
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
