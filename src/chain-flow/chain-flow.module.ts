import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { ChainFlowController } from './chain-flow.controller';
import { ChainFlowService } from './chain-flow.service';

@Module({
  imports: [ClientsModule, ConfigurationModule, PayoutsModule],
  controllers: [ChainFlowController],
  providers: [ChainFlowService],
})
export class ChainFlowModule {}
