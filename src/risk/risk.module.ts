import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [AuditModule, ConfigurationModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
