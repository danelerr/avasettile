import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WebhookModule } from '../webhooks/webhook.module';
import { PayInLedgerService } from './payin-ledger.service';
import { PayinsController } from './payins.controller';
import { PayinsService } from './payins.service';

@Module({
  imports: [
    AuditModule,
    BlockchainModule,
    ClientsModule,
    ConfigurationModule,
    WebhookModule,
  ],
  controllers: [PayinsController],
  providers: [PayinsService, PayInLedgerService],
  exports: [PayinsService, PayInLedgerService],
})
export class PayinsModule {}
