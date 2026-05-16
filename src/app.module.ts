import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { HealthModule } from './health/health.module';
import { PayoutsModule } from './payouts/payouts.module';
import { TreasuryModule } from './treasury/treasury.module';

@Module({
  imports: [
    ConfigurationModule,
    HealthModule,
    BlockchainModule,
    AuditModule,
    PayoutsModule,
    TreasuryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
