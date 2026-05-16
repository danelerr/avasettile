import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StorageModule } from '../storage/storage.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ConfigurationModule, StorageModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
