import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AuditService } from './audit.service';

@Module({
  imports: [StorageModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
