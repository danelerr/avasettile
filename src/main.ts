import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import { AppModule } from './app.module';
import { ConfigurationService } from './configuration/configuration.service';

loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configuration = app.get(ConfigurationService);

  app.enableCors({
    origin: configuration.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-avasettle-api-key',
      'x-correlation-id',
      'x-institution-id',
    ],
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle('AvaSettle On-chain Provider API')
    .setDescription(
      'B2B API for Chain Flow and institutional orchestrators to prepare, authorize, broadcast, and reconcile Avalanche stablecoin payouts.',
    )
    .setVersion(configuration.version)
    .addServer(`http://localhost:${configuration.port}`, 'Local development')
    .addTag('health', 'Service metadata, liveness, and readiness checks.')
    .addTag(
      'treasury',
      'Treasury configuration, balances, and settlement controls.',
    )
    .addTag(
      'payouts',
      'Institutional payout lifecycle and on-chain reconciliation.',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-avasettle-api-key',
        in: 'header',
        description: 'Shared B2B API key issued to Chain Flow.',
      },
      'avasettle-api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API key',
        description:
          'Alternative API key transport using Authorization: Bearer.',
      },
      'chain-flow-bearer',
    )
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, openApiConfig, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });
  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs/json',
  });

  await app.listen(configuration.port);
}

bootstrap().catch((error) => {
  console.error('AvaSettle failed to start', error);
  process.exit(1);
});
