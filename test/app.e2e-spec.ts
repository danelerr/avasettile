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
