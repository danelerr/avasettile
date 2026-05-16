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
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { SettlementService } from './settlement.service';

@ApiTags('settlement')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('v1/settlements')
@UseGuards(ApiKeyGuard)
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Post()
  @ApiOperation({
    summary: 'Create simulated fiat settlement',
    description:
      'Creates a simulated fiat settlement record from a payout, pay-in, or manual source. No banking rail is called.',
  })
  @ApiBody({ type: CreateSettlementDto })
  @ApiCreatedResponse({
    schema: {
      example: {
        id: 'settlement-uuid',
        sourceType: 'payout',
        status: 'pending',
        asset: 'USDC',
        cryptoAmount: '25.50',
        fiatCurrency: 'USD',
        fiatAmount: '25.50',
        rail: 'simulated-fiat-rail',
      },
    },
  })
  create(
    @Body() dto: CreateSettlementDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.settlement.create(
      dto,
      this.toRequestContext(headers, sourceIp),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List settlements' })
  @ApiOkResponse({ description: 'Settlement records.' })
  list(@Query() query: ListSettlementsQueryDto) {
    return this.settlement.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement by id' })
  @ApiParam({ name: 'id', example: 'settlement-uuid' })
  get(@Param('id') id: string) {
    return this.settlement.get(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark simulated fiat settlement as completed' })
  @ApiParam({ name: 'id', example: 'settlement-uuid' })
  complete(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.settlement.complete(
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
