import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { HealthModule } from './health/health.module';
import { PayoutsModule } from './payouts/payouts.module';
import { TreasuryModule } from './treasury/treasury.module';
import { StorageModule } from './storage/storage.module';
import { ChainFlowModule } from './chain-flow/chain-flow.module';
import { PayinsModule } from './payins/payins.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { ReportsModule } from './reports/reports.module';
import { SettlementModule } from './settlement/settlement.module';
import { RiskModule } from './risk/risk.module';
import { PrivacyModule } from './privacy/privacy.module';

@Module({
  imports: [
    ConfigurationModule,
    HealthModule,
    BlockchainModule,
    AuditModule,
    PayoutsModule,
    TreasuryModule,
    StorageModule,
    ChainFlowModule,
    PayinsModule,
    ReconciliationModule,
    ReportsModule,
    SettlementModule,
    RiskModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
