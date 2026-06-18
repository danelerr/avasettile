import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ClientsModule } from './clients/clients.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ThrottleMiddleware } from './common/throttle.middleware';
import { ApiRequestMiddleware } from './observability/api-request.middleware';
import { ObservabilityModule } from './observability/observability.module';
import { TraceMiddleware } from './observability/trace.middleware';
import { HealthModule } from './health/health.module';
import { PayoutsModule } from './payouts/payouts.module';
import { TreasuryModule } from './treasury/treasury.module';
import { ChainFlowModule } from './chain-flow/chain-flow.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PayinsModule } from './payins/payins.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { ReportsModule } from './reports/reports.module';
import { DatabaseModule } from './database/database.module';
import { StartupModule } from './startup/startup.module';
import { WebhookModule } from './webhooks/webhook.module';

@Module({
  imports: [
    ConfigurationModule,
    ObservabilityModule,
    DatabaseModule,
    HealthModule,
    BlockchainModule,
    AuditModule,
    ClientsModule,
    WebhookModule,
    PayoutsModule,
    TreasuryModule,
    ChainFlowModule,
    PayinsModule,
    CheckoutModule,
    ReconciliationModule,
    ReportsModule,
    StartupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TraceMiddleware, ApiRequestMiddleware, ThrottleMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
