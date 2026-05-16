import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthorizePayoutDto } from '../payouts/dto/authorize-payout.dto';
import { CreatePayoutDto } from '../payouts/dto/create-payout.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { PayoutResponse, RequestContext } from '../payouts/payout.types';
import { RiskService } from '../risk/risk.service';
import {
  ChainFlowEstadoRetiroDto,
  ChainFlowRetiroDto,
} from './dto/chain-flow-retiro.dto';

@Injectable()
export class ChainFlowService {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly risk: RiskService,
  ) {}

  async prepararRetiro(dto: ChainFlowRetiroDto, context: RequestContext) {
    const createDto = this.toCreatePayoutDto(dto);
    const risk = this.risk.assess(
      {
        subjectType: 'payout',
        subjectId: createDto.externalId,
        amount: createDto.amount,
        asset: createDto.asset,
        address: createDto.beneficiaryAddress,
        metadata: createDto.metadata,
      },
      context,
    );
    if (risk.decision === 'reject') {
      throw new BadRequestException({
        codigo: 'RISK_REJECTED',
        mensaje: 'Retiro rechazado por controles de riesgo.',
        risk,
      });
    }

    const payout = await this.payouts.createPayout(createDto, context);
    return this.toChainFlowResponse(payout, 'Retiro preparado.', risk);
  }

  async autorizarRetiro(
    dto: ChainFlowEstadoRetiroDto,
    context: RequestContext,
  ) {
    const payout = this.resolvePayout(dto);
    const authorized = await this.payouts.authorizePayout(
      payout.id,
      {
        approvedBy: 'chain-flow',
        riskDecisionId: `chain-flow-${payout.externalId}`,
      } satisfies AuthorizePayoutDto,
      context,
    );
    return this.toChainFlowResponse(authorized, 'Retiro autorizado.');
  }

  consultarEstadoRetiro(dto: ChainFlowEstadoRetiroDto) {
    const payout = this.resolvePayout(dto);
    return this.toChainFlowResponse(payout, 'Estado de retiro consultado.');
  }

  private resolvePayout(dto: ChainFlowEstadoRetiroDto): PayoutResponse {
    if (dto.payoutId) return this.payouts.getPayout(dto.payoutId);

    const externalId = dto.externalId ?? dto.idRetiro ?? dto.id_retiro;
    if (!externalId) {
      throw new BadRequestException(
        'payoutId, externalId, idRetiro or id_retiro is required.',
      );
    }

    return this.payouts.getPayoutByExternalId(externalId);
  }

  private toCreatePayoutDto(dto: ChainFlowRetiroDto): CreatePayoutDto {
    const externalId = dto.externalId ?? dto.idRetiro ?? dto.id_retiro;
    const amount = dto.amount ?? dto.monto;
    const asset = (dto.asset ?? dto.moneda ?? 'USDC').toUpperCase();
    const beneficiaryAddress =
      dto.beneficiaryAddress ?? dto.direccionDestino ?? dto.wallet;

    if (!externalId) {
      throw new BadRequestException('externalId or idRetiro is required.');
    }
    if (!amount) {
      throw new BadRequestException('amount or monto is required.');
    }
    if (asset !== 'USDC' && asset !== 'USDT') {
      throw new BadRequestException('asset/moneda must be USDC or USDT.');
    }
    if (!beneficiaryAddress) {
      throw new BadRequestException(
        'beneficiaryAddress, direccionDestino or wallet is required.',
      );
    }

    return {
      externalId,
      amount,
      asset,
      beneficiaryAddress,
      beneficiaryName: dto.beneficiario,
      chainFlowRequestId: dto.idRetiro ?? dto.id_retiro,
      metadata: {
        ...(dto.metadata ?? {}),
        source: 'chain-flow-compat',
      },
    };
  }

  private toChainFlowResponse(
    payout: PayoutResponse,
    mensaje: string,
    risk?: unknown,
  ) {
    return {
      codigo: '00',
      mensaje,
      retiroId: payout.externalId,
      payoutId: payout.id,
      estado: payout.status,
      txHash: payout.transactionHash,
      red: payout.network,
      chainId: payout.chainId,
      asset: payout.asset,
      monto: payout.amount,
      montoAtomic: payout.amountAtomic,
      beneficiario: payout.beneficiaryAddress,
      creadoEn: payout.createdAt,
      actualizadoEn: payout.updatedAt,
      risk,
    };
  }
}
