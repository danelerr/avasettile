import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { CreatePayInDto } from './dto/create-payin.dto';
import { ListPayInsQueryDto } from './dto/list-payins-query.dto';
import { PayinsService } from './payins.service';

const payInExample = {
  id: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10',
  externalId: 'chainflow-payin-0001',
  status: 'pending',
  network: 'avalanche-fuji',
  chainId: 43113,
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  expectedAmount: '100.00',
  expectedAmountAtomic: '100000000',
  receivedAmount: '0',
  receivedAmountAtomic: '0',
  depositAddress: '0x1111111111111111111111111111111111111111',
  derivationIndex: 0,
  startBlock: '123456',
  transfers: [],
};

@ApiTags('payins')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid AvaSettle API key.',
})
@Controller('v1/payins')
@UseGuards(ApiKeyGuard)
export class PayinsController {
  constructor(private readonly payins: PayinsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a pay-in request',
    description:
      'Derives a real EVM deposit address from AVASETTLE_PAYIN_MNEMONIC and stores a pay-in request for later on-chain reconciliation.',
  })
  @ApiBody({ type: CreatePayInDto })
  @ApiCreatedResponse({
    description: 'Pay-in address generated and persisted.',
    schema: { example: payInExample },
  })
  createPayIn(
    @Body() dto: CreatePayInDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.payins.createPayIn(
      dto,
      this.toRequestContext(headers, sourceIp),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List pay-ins',
    description:
      'Lists pay-in requests and supports filtering by status or externalId.',
  })
  @ApiOkResponse({ schema: { example: [payInExample] } })
  listPayIns(@Query() query: ListPayInsQueryDto) {
    return this.payins.listPayIns(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pay-in by id' })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiOkResponse({ schema: { example: payInExample } })
  getPayIn(@Param('id') id: string) {
    return this.payins.getPayIn(id);
  }

  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Reconcile pay-in on-chain',
    description:
      'Scans ERC-20 Transfer logs to the derived deposit address and updates received amount/status.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiOkResponse({
    schema: { example: { ...payInExample, status: 'confirmed' } },
  })
  reconcilePayIn(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.payins.reconcilePayIn(
      id,
      this.toRequestContext(headers, sourceIp),
    );
  }

  private toRequestContext(
    headers: Record<string, string | string[] | undefined>,
    sourceIp: string,
  ): RequestContext {
    return {
      institutionId: this.firstHeader(headers['x-institution-id']),
      correlationId: this.firstHeader(headers['x-correlation-id']),
      idempotencyKey: this.firstHeader(headers['idempotency-key']),
      actor: this.firstHeader(headers.authorization) ? 'chain-flow' : null,
      sourceIp,
    };
  }

  private firstHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
