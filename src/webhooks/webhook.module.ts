import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WebhookService } from './webhook.service';

@Module({
  imports: [ConfigurationModule],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
