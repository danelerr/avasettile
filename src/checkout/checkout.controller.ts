import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

/**
 * Public, unauthenticated hosted-checkout surface. Intentionally NOT guarded by
 * ClientApiKeyGuard: the invoice id is the capability (an unguessable UUID), and
 * every response is the safe public projection from CheckoutService.
 */
@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Public checkout configuration',
    description:
      'Network, chain id, explorer, PaymentRouter address, and stablecoin token the page needs to build a payment. No secrets.',
  })
  getConfig() {
    return this.checkout.getConfig();
  }

  @Post('sessions')
  @ApiOperation({
    summary: 'Create a checkout invoice',
    description:
      'Issues a PaymentRouter invoice anyone can pay. Disabled when AVASETTLE_CHECKOUT_DEMO_ENABLED=false.',
  })
  createSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.checkout.createSession(dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get checkout invoice status' })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiOkResponse({ description: 'Safe public projection of the invoice.' })
  getSession(@Param('id') id: string) {
    return this.checkout.getSession(id);
  }

  @Post('sessions/:id/reconcile')
  @ApiOperation({
    summary: 'Reconcile a checkout invoice on demand',
    description:
      'Re-scans the chain for this invoice so the payer sees confirmation without waiting for the background reconcile loop.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  reconcileSession(@Param('id') id: string) {
    return this.checkout.reconcileSession(id);
  }
}
