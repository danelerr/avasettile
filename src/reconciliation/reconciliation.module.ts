import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { PayinsModule } from '../payins/payins.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [ConfigurationModule, PayinsModule, PayoutsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
