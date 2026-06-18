import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../configuration/configuration.module';
import { PayinsModule } from '../payins/payins.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PayinsModule, ConfigurationModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
