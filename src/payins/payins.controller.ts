import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
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
import { ClientApiKeyGuard } from '../auth/client-api-key.guard';
import type { AuthenticatedRequest } from '../auth/client-api-key.guard';
import { extractRequestContext } from '../common/request-context.util';
import { AcceptPayInDto } from './dto/accept-payin.dto';
import { CreatePayInDto } from './dto/create-payin.dto';
import { ListPayInsQueryDto } from './dto/list-payins-query.dto';
import { SweepPayInDto } from './dto/sweep-payin.dto';
import { TopUpAndSweepDto } from './dto/topup-and-sweep.dto';
import { TopUpPayInDto } from './dto/topup-payin.dto';
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
  sweepStatus: 'pending',
  sweepTransactionHash: null,
};

@ApiTags('payins')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid AvaSettle API key.',
})
@Controller('v1/payins')
@UseGuards(ClientApiKeyGuard)
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.createPayIn(dto, extractRequestContext(request));
  }

  @Get()
  @ApiOperation({
    summary: 'List pay-ins',
    description:
      'Lists pay-in requests of the calling client; supports filtering by status or externalId.',
  })
  @ApiOkResponse({ schema: { example: [payInExample] } })
  listPayIns(
    @Query() query: ListPayInsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.listPayIns(query, extractRequestContext(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pay-in by id' })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiOkResponse({ schema: { example: payInExample } })
  getPayIn(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.payins.getPayIn(id, extractRequestContext(request));
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.reconcilePayIn(id, extractRequestContext(request));
  }

  @Post(':id/sweep')
  @ApiOperation({
    summary: 'Sweep a derived pay-in address into treasury',
    description:
      'Signs from the derived pay-in EOA and transfers its ERC-20 balance to the configured institutional treasury. PaymentRouter pay-ins settle directly to treasury and return not_required.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiBody({ type: SweepPayInDto, required: false })
  @ApiOkResponse({
    schema: {
      example: {
        ...payInExample,
        status: 'confirmed',
        sweepStatus: 'broadcasted',
        sweepTransactionHash:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    },
  })
  sweepPayIn(
    @Param('id') id: string,
    @Body() dto: SweepPayInDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.sweepPayIn(
      id,
      dto ?? {},
      extractRequestContext(request),
    );
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: 'Accept an underpaid or overpaid pay-in',
    description:
      'Manually marks an underpaid or overpaid pay-in as confirmed, with an optional operator note. Use when the institution decides to accept the received amount regardless of the discrepancy.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiBody({ type: AcceptPayInDto, required: false })
  @ApiOkResponse({
    schema: {
      example: {
        id: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10',
        status: 'confirmed',
        acceptedAt: '2026-06-09T10:00:00.000Z',
        acceptanceNote: 'Client confirmed partial payment acceptable.',
      },
    },
  })
  acceptPayIn(
    @Param('id') id: string,
    @Body() dto: AcceptPayInDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.acceptPayIn(
      id,
      dto ?? {},
      extractRequestContext(request),
    );
  }

  @Post(':id/topup')
  @ApiOperation({
    summary: 'Top-up deposit address with AVAX for sweep gas',
    description:
      'Sends AVAX from the treasury to the derived deposit address so it can pay gas for the ERC-20 sweep transaction. Defaults to 0.002 AVAX, which covers a standard USDC transfer on Avalanche C-Chain.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiBody({ type: TopUpPayInDto, required: false })
  @ApiOkResponse({
    schema: {
      example: {
        id: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10',
        depositAddress: '0x1111111111111111111111111111111111111111',
        status: 'confirmed',
      },
    },
  })
  topUpPayIn(
    @Param('id') id: string,
    @Body() dto: TopUpPayInDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.topUpPayIn(
      id,
      dto ?? {},
      extractRequestContext(request),
    );
  }

  @Post(':id/topup-and-sweep')
  @ApiOperation({
    summary: 'Top-up gas and sweep in one operation',
    description:
      'Sends AVAX from treasury to the deposit address, waits for confirmation, then immediately sweeps the ERC-20 balance to treasury. Use this instead of calling /topup and /sweep separately.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiBody({ type: TopUpAndSweepDto, required: false })
  @ApiOkResponse({
    schema: {
      example: {
        ...payInExample,
        status: 'confirmed',
        sweepStatus: 'broadcasted',
        sweepTransactionHash: '0xaaa...',
      },
    },
  })
  topUpAndSweep(
    @Param('id') id: string,
    @Body() dto: TopUpAndSweepDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payins.topUpAndSweep(
      id,
      dto ?? {},
      extractRequestContext(request),
    );
  }
}
