import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { RiskModule } from '../risk/risk.module';
import { ChainFlowController } from './chain-flow.controller';
import { ChainFlowService } from './chain-flow.service';

@Module({
  imports: [ConfigurationModule, PayoutsModule, RiskModule],
  controllers: [ChainFlowController],
  providers: [ChainFlowService],
})
export class ChainFlowModule {}
