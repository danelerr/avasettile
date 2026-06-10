import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WebhookModule } from '../webhooks/webhook.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuditModule, ClientsModule, ConfigurationModule, WebhookModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
