import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { ChainFlowService } from './chain-flow.service';
import {
  ChainFlowEstadoRetiroDto,
  ChainFlowRetiroDto,
} from './dto/chain-flow-retiro.dto';

@ApiTags('chain-flow-compat')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('api')
@UseGuards(ApiKeyGuard)
export class ChainFlowController {
  constructor(private readonly chainFlow: ChainFlowService) {}

  @Post('prepararretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout preparation',
    description:
      'Compatibility wrapper that maps Chain Flow retiro payloads to POST /v1/payouts and returns provider-style Spanish response fields.',
  })
  @ApiBody({ type: ChainFlowRetiroDto })
  @ApiOkResponse({
    schema: {
      example: {
        codigo: '00',
        mensaje: 'Retiro preparado.',
        tcTransaccionExterna: 'EXT-0001',
        tnRetiroPago: 12345,
        tnTransferenciaBloque: 9001,
        tnProcesadorPagos: 3,
        tnMoneda: 1,
        tcCuentaDestino: '0x1111111111111111111111111111111111111111',
        retiroId: 'EXT-0001',
        payoutId: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177',
        estado: 'prepared',
        estadoChainFlow: 'PREPARADO',
        txHash: null,
      },
    },
  })
  prepararRetiro(
    @Body() dto: ChainFlowRetiroDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.chainFlow.prepararRetiro(
      dto,
      this.toRequestContext(headers, sourceIp),
    );
  }

  @Post('autorizarretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout authorization',
    description:
      'Compatibility wrapper that locates a prepared payout and broadcasts the Avalanche ERC-20 transfer.',
  })
  @ApiBody({ type: ChainFlowEstadoRetiroDto })
  autorizarRetiro(
    @Body() dto: ChainFlowEstadoRetiroDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.chainFlow.autorizarRetiro(
      dto,
      this.toRequestContext(headers, sourceIp),
    );
  }

  @Get('consultarestadoretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout status query',
    description:
      'GET variant for providers that query withdrawal status with query string parameters.',
  })
  consultarEstadoRetiroGet(@Query() query: ChainFlowEstadoRetiroDto) {
    return this.chainFlow.consultarEstadoRetiro(query);
  }

  @Post('consultarestadoretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout status query',
    description:
      'POST variant for providers that query withdrawal status with a JSON body.',
  })
  @ApiBody({ type: ChainFlowEstadoRetiroDto })
  consultarEstadoRetiroPost(@Body() dto: ChainFlowEstadoRetiroDto) {
    return this.chainFlow.consultarEstadoRetiro(dto);
  }

  private toRequestContext(
    headers: Record<string, string | string[] | undefined>,
    sourceIp: string,
  ): RequestContext {
    return {
      institutionId: this.firstHeader(headers['x-institution-id']),
      correlationId: this.firstHeader(headers['x-correlation-id']),
      idempotencyKey: this.firstHeader(headers['idempotency-key']),
      actor: 'chain-flow',
      sourceIp,
    };
  }

  private firstHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
