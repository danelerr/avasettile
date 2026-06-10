import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ClientApiKeyGuard } from '../auth/client-api-key.guard';
import type { AuthenticatedRequest } from '../auth/client-api-key.guard';
import { extractRequestContext } from '../common/request-context.util';
import { ChainFlowService } from './chain-flow.service';
import {
  ChainFlowEstadoRetiroDto,
  ChainFlowRetiroDto,
} from './dto/chain-flow-retiro.dto';

@ApiTags('chain-flow-compat')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('api')
@UseGuards(ClientApiKeyGuard)
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chainFlow.prepararRetiro(
      dto,
      extractRequestContext(request, 'chain-flow'),
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chainFlow.autorizarRetiro(
      dto,
      extractRequestContext(request, 'chain-flow'),
    );
  }

  @Get('consultarestadoretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout status query (GET)',
  })
  consultarEstadoRetiroGet(
    @Query() query: ChainFlowEstadoRetiroDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chainFlow.consultarEstadoRetiro(
      query,
      extractRequestContext(request, 'chain-flow'),
    );
  }

  @Post('consultarestadoretiro')
  @ApiOperation({
    summary: 'Chain Flow compatible payout status query (POST)',
  })
  @ApiBody({ type: ChainFlowEstadoRetiroDto })
  consultarEstadoRetiroPost(
    @Body() dto: ChainFlowEstadoRetiroDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chainFlow.consultarEstadoRetiro(
      dto,
      extractRequestContext(request, 'chain-flow'),
    );
  }
}
