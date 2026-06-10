import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WebhookService } from './webhook.service';

@Module({
  imports: [ClientsModule, ConfigurationModule],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
