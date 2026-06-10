import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WebhookModule } from '../webhooks/webhook.module';
import { PayoutLedgerService } from './payout-ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [
    AuditModule,
    BlockchainModule,
    ClientsModule,
    ConfigurationModule,
    WebhookModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutLedgerService],
  exports: [PayoutsService, PayoutLedgerService],
})
export class PayoutsModule {}
