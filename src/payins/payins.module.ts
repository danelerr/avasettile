import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StorageModule } from '../storage/storage.module';
import { PayInLedgerService } from './payin-ledger.service';
import { PayinsController } from './payins.controller';
import { PayinsService } from './payins.service';

@Module({
  imports: [AuditModule, BlockchainModule, ConfigurationModule, StorageModule],
  controllers: [PayinsController],
  providers: [PayinsService, PayInLedgerService],
  exports: [PayinsService, PayInLedgerService],
})
export class PayinsModule {}
