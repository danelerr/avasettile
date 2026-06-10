import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StorageModule } from '../storage/storage.module';
import { WebhookModule } from '../webhooks/webhook.module';
import { PayoutLedgerService } from './payout-ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [AuditModule, BlockchainModule, ConfigurationModule, StorageModule, WebhookModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutLedgerService],
  exports: [PayoutsService, PayoutLedgerService],
})
export class PayoutsModule {}
