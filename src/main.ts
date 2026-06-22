import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import { AppModule } from './app.module';
import { ConfigurationService } from './configuration/configuration.service';
import { loadConfigFile } from './configuration/config-file.loader';
import { ApiExceptionFilter } from './observability/api-exception.filter';

// Load .env files first so secrets in them take precedence over config file.
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });
// Fill in non-secret operational config from JSON config file for any vars not already set.
loadConfigFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configuration = app.get(ConfigurationService);

  // Behind a load balancer, resolve req.ip to the real client address.
  const trustProxy = configuration.trustProxy;
  if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
  }

  app.enableCors({
    origin: configuration.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-avasettle-api-key',
      'x-correlation-id',
      'x-request-id',
      'traceparent',
      'tracestate',
    ],
    exposedHeaders: ['x-request-id'],
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiExceptionFilter());
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
      'Multi-tenant B2B API for institutions to prepare, authorize, broadcast, and reconcile Avalanche stablecoin pay-ins and payouts.',
    )
    .setVersion(configuration.version)
    .addServer(`http://localhost:${configuration.port}`, 'Local development')
    .addTag('health', 'Service metadata, liveness, and readiness checks.')
    .addTag(
      'clients',
      'Platform-operator endpoints to register clients and issue API keys.',
    )
    .addTag(
      'treasury',
      'Treasury configuration, balances, and settlement controls.',
    )
    .addTag(
      'payouts',
      'Institutional payout lifecycle and on-chain reconciliation.',
    )
    .addTag(
      'chain-flow-compat',
      'Legacy provider endpoints consumed by Chain Flow.',
    )
    .addTag(
      'payins',
      'Real EVM deposit address generation and pay-in reconciliation.',
    )
    .addTag('reconciliation', 'Semi-automatic on-chain reconciliation jobs.')
    .addTag('reports', 'Operational reporting per client.')
    .addTag(
      'checkout',
      'Public hosted-checkout: PaymentRouter invoices anyone can pay from a browser.',
    )
    .addTag(
      'settlements',
      'Confidential settlements: on-chain hash commitments with selective audit disclosure.',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-avasettle-api-key',
        in: 'header',
        description: 'Per-client API key issued via POST /v1/admin/clients.',
      },
      'avasettle-api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-avasettle-api-key',
        in: 'header',
        description: 'Platform-operator admin key (AVASETTLE_ADMIN_API_KEY).',
      },
      'avasettle-admin-key',
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
