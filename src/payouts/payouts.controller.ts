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
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClientApiKeyGuard } from '../auth/client-api-key.guard';
import type { AuthenticatedRequest } from '../auth/client-api-key.guard';
import { extractRequestContext } from '../common/request-context.util';
import { AuthorizePayoutDto } from './dto/authorize-payout.dto';
import { BatchAuthorizePayoutDto } from './dto/batch-authorize-payout.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { PayoutsService } from './payouts.service';

const payoutExample = {
  id: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177',
  externalId: 'chainflow-payout-0001',
  chainFlowRequestId: 'cf-req-0001',
  status: 'prepared',
  network: 'avalanche-fuji',
  chainId: 43113,
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  amount: '25.50',
  amountAtomic: '25500000',
  beneficiaryAddress: '0x1111111111111111111111111111111111111111',
  beneficiaryName: 'Cliente LATAM',
  treasuryAddress: '0x2222222222222222222222222222222222222222',
  transactionHash: null,
  failureReason: null,
  memo: 'Payout approved by Chain Flow',
  metadata: { country: 'BO', fiatRail: 'bank-transfer' },
  createdAt: '2026-05-16T21:22:09.663Z',
  updatedAt: '2026-05-16T21:22:09.663Z',
  authorizedAt: null,
  broadcastedAt: null,
  confirmedAt: null,
  auditTrail: [
    {
      type: 'PAYOUT_PREPARED',
      createdAt: '2026-05-16T21:22:09.663Z',
      correlationId: 'payout-123',
    },
  ],
};

@ApiTags('payouts')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid AvaSettle API key.',
})
@Controller('v1/payouts')
@UseGuards(ClientApiKeyGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post()
  @ApiOperation({
    summary: 'Prepare a payout',
    description:
      'Creates a payout intent, validates the requested asset/amount/address, converts the amount to token atomic units, and stores the payout as prepared. This does not broadcast on-chain unless executeImmediately is true.',
  })
  @ApiBody({ type: CreatePayoutDto })
  @ApiCreatedResponse({
    description:
      'Payout intent prepared. Reusing the same externalId returns the existing payout as an idempotent replay.',
    schema: { example: payoutExample },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid asset, amount, beneficiary address, or request shape.',
  })
  createPayout(
    @Body() dto: CreatePayoutDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payouts.createPayout(dto, extractRequestContext(request));
  }

  @Get()
  @ApiOperation({
    summary: 'List payouts',
    description:
      'Returns the payout ledger records of the calling client. Filter by lifecycle status or externalId.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['prepared', 'authorized', 'broadcasted', 'confirmed', 'failed'],
  })
  @ApiQuery({
    name: 'externalId',
    required: false,
    example: 'chainflow-payout-0001',
  })
  @ApiOkResponse({
    description: 'Filtered payout list ordered by most recent creation time.',
    schema: { example: [payoutExample] },
  })
  listPayouts(
    @Query() query: ListPayoutsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payouts.listPayouts(query, extractRequestContext(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payout by id' })
  @ApiParam({ name: 'id', example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177' })
  @ApiOkResponse({
    description: 'Payout detail.',
    schema: { example: payoutExample },
  })
  getPayout(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.payouts.getPayout(id, extractRequestContext(request));
  }

  @Post('batch-authorize')
  @ApiOperation({
    summary: 'Authorize a batch of payouts atomically (SettlementVault)',
    description:
      'Authorizes many prepared payouts of the same asset and settles them in a single atomic SettlementVault batch — either every leg pays or the whole transaction reverts. Requires AVASETTLE_SETTLEMENT_VAULT_ADDRESS.',
  })
  @ApiBody({ type: BatchAuthorizePayoutDto })
  @ApiOkResponse({
    description: 'The settled payouts.',
    schema: {
      example: [
        {
          ...payoutExample,
          status: 'broadcasted',
          transactionHash:
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
    },
  })
  @ApiConflictResponse({
    description:
      'A payout is not prepared, assets differ, or treasury balance is insufficient.',
  })
  authorizePayoutBatch(
    @Body() dto: BatchAuthorizePayoutDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payouts.authorizePayoutBatch(
      dto.payoutIds,
      dto,
      extractRequestContext(request),
    );
  }

  @Post(':id/authorize')
  @ApiOperation({
    summary: 'Authorize and broadcast payout',
    description:
      'Moves a prepared payout into the authorization phase, checks treasury token balance, signs with AVASETTLE_TREASURY_PRIVATE_KEY, and broadcasts the transaction on Avalanche.',
  })
  @ApiParam({ name: 'id', example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177' })
  @ApiBody({ type: AuthorizePayoutDto })
  @ApiOkResponse({
    schema: {
      example: {
        ...payoutExample,
        status: 'broadcasted',
        transactionHash:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        authorizedAt: '2026-05-16T21:23:00.000Z',
        broadcastedAt: '2026-05-16T21:23:01.000Z',
      },
    },
  })
  @ApiConflictResponse({
    description:
      'Payout is not in a broadcastable state or treasury balance is insufficient.',
  })
  authorizePayout(
    @Param('id') id: string,
    @Body() dto: AuthorizePayoutDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payouts.authorizePayout(
      id,
      dto,
      extractRequestContext(request),
    );
  }

  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Reconcile payout on-chain',
    description:
      'Reads the Avalanche transaction receipt for a broadcasted payout, calculates confirmation depth, marks reverted transactions as failed, and marks successful transactions as confirmed after the configured confirmation threshold.',
  })
  @ApiParam({ name: 'id', example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177' })
  @ApiOkResponse({
    schema: {
      example: {
        ...payoutExample,
        status: 'confirmed',
        transactionHash:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        confirmedAt: '2026-05-16T21:25:00.000Z',
      },
    },
  })
  @ApiConflictResponse({
    description:
      'Payout has not been broadcasted yet and has no transaction hash.',
  })
  reconcilePayout(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payouts.reconcilePayout(id, extractRequestContext(request));
  }
}
