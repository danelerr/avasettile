import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { PayoutLedgerService } from './payout-ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [AuditModule, BlockchainModule, ConfigurationModule],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutLedgerService],
})
export class PayoutsModule {}
