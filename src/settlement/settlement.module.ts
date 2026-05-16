import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StorageModule } from '../storage/storage.module';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AuditModule, ConfigurationModule, StorageModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
