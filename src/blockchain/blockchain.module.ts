import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { BlockchainService } from './blockchain.service';
import { TreasurySignerService } from './treasury-signer.service';

@Module({
  imports: [ConfigurationModule],
  providers: [BlockchainService, TreasurySignerService],
  exports: [BlockchainService, TreasurySignerService],
})
export class BlockchainModule {}
