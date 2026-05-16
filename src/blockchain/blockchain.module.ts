import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [ConfigurationModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
