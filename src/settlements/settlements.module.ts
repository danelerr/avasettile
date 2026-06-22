import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsRepository } from './settlements.repository';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [AuditModule, BlockchainModule, ClientsModule, ConfigurationModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementsRepository],
})
export class SettlementsModule {}
