import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { StartupValidationService } from './startup-validation.service';

@Module({
  imports: [ConfigurationModule],
  providers: [StartupValidationService],
})
export class StartupModule {}
