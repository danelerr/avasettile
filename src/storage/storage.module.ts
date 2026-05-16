import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigurationModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
