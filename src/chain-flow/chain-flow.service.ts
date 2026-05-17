import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthorizePayoutDto } from '../payouts/dto/authorize-payout.dto';
import { CreatePayoutDto } from '../payouts/dto/create-payout.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { PayoutResponse, RequestContext } from '../payouts/payout.types';
import { RiskService } from '../risk/risk.service';
import { SettlementAsset } from '../configuration/configuration.types';
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

    const identifiers = this.statusLookupIdentifiers(dto);
    if (identifiers.length === 0) {
      throw new BadRequestException(
        'payoutId, tcTransaccionExterna, externalId, idRetiro, id_retiro, tnRetiroPago or tnTransferenciaBloque is required.',
      );
    }

    for (const identifier of identifiers) {
      const payout = this.tryGetPayoutByExternalId(identifier);
      if (payout) return payout;
    }

    const payoutByChainFlowMetadata = this.payouts
      .listPayouts({})
      .find((payout) => this.matchesChainFlowLookup(payout, identifiers));
    if (payoutByChainFlowMetadata) return payoutByChainFlowMetadata;

    return this.payouts.getPayoutByExternalId(identifiers[0]);
  }

  private toCreatePayoutDto(dto: ChainFlowRetiroDto): CreatePayoutDto {
    const externalId = this.normalizeIdentifier(
      dto.tcTransaccionExterna ??
        dto.externalId ??
        dto.idRetiro ??
        dto.id_retiro ??
        dto.tnRetiroPago,
    );
    const amount = this.normalizeIdentifier(
      dto.tnMonto ?? dto.amount ?? dto.monto,
    );
    const asset = this.resolveAsset(dto.tnMoneda ?? dto.asset ?? dto.moneda);
    const beneficiaryAddress =
      dto.tcCuentaDestino ??
      dto.beneficiaryAddress ??
      dto.direccionDestino ??
      dto.wallet;
    const chainFlowRequestId = this.normalizeIdentifier(
      dto.idRetiro ??
        dto.id_retiro ??
        dto.tnRetiroPago ??
        dto.tnTransferenciaBloque,
    );

    if (!externalId) {
      throw new BadRequestException(
        'tcTransaccionExterna, externalId, idRetiro or tnRetiroPago is required.',
      );
    }
    if (!amount) {
      throw new BadRequestException('tnMonto, amount or monto is required.');
    }
    if (!beneficiaryAddress) {
      throw new BadRequestException(
        'tcCuentaDestino, beneficiaryAddress, direccionDestino or wallet is required.',
      );
    }

    const sourceMetadata = dto.metadata ?? {};
    const chainFlowMetadata = {
      ...this.asRecord(sourceMetadata.chainFlow),
      ...this.compactRecord({
        tcTransaccionExterna: dto.tcTransaccionExterna,
        tnRetiroPago: dto.tnRetiroPago,
        tnTransferenciaBloque: dto.tnTransferenciaBloque,
        tnProcesadorPagos: dto.tnProcesadorPagos,
        tnMoneda: dto.tnMoneda,
        tcCuentaDestino: dto.tcCuentaDestino,
      }),
    };

    return {
      externalId,
      amount,
      asset,
      beneficiaryAddress,
      beneficiaryName: dto.beneficiario,
      chainFlowRequestId: chainFlowRequestId ?? undefined,
      metadata: {
        ...sourceMetadata,
        source: 'chain-flow-compat',
        chainFlow: chainFlowMetadata,
      },
    };
  }

  private toChainFlowResponse(
    payout: PayoutResponse,
    mensaje: string,
    risk?: unknown,
  ) {
    const chainFlow = this.chainFlowMetadata(payout);
    return {
      codigo: '00',
      mensaje,
      tcTransaccionExterna:
        this.normalizeIdentifier(chainFlow.tcTransaccionExterna) ??
        payout.externalId,
      tnRetiroPago: chainFlow.tnRetiroPago ?? null,
      tnTransferenciaBloque: chainFlow.tnTransferenciaBloque ?? null,
      tnProcesadorPagos: chainFlow.tnProcesadorPagos ?? null,
      tnMoneda: chainFlow.tnMoneda ?? this.assetCode(payout.asset),
      tcCuentaDestino: payout.beneficiaryAddress,
      retiroId: payout.externalId,
      payoutId: payout.id,
      estado: payout.status,
      estadoAvaSettle: payout.status,
      estadoChainFlow: this.toChainFlowStatus(payout.status),
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

  private resolveAsset(rawAsset: unknown): SettlementAsset {
    const asset = this.normalizeIdentifier(rawAsset) ?? 'USDC';
    const normalized = asset.toUpperCase();

    if (normalized === '1') return 'USDC';
    if (normalized === '2') return 'USDT';
    if (normalized === 'USDC' || normalized === 'USDT') return normalized;

    throw new BadRequestException(
      'tnMoneda/asset/moneda must be 1, 2, USDC or USDT.',
    );
  }

  private statusLookupIdentifiers(dto: ChainFlowEstadoRetiroDto): string[] {
    return [
      dto.tcTransaccionExterna,
      dto.externalId,
      dto.idRetiro,
      dto.id_retiro,
      dto.tnRetiroPago,
      dto.tnTransferenciaBloque,
    ].reduce<string[]>((identifiers, value) => {
      const identifier = this.normalizeIdentifier(value);
      if (identifier && !identifiers.includes(identifier)) {
        identifiers.push(identifier);
      }
      return identifiers;
    }, []);
  }

  private tryGetPayoutByExternalId(externalId: string): PayoutResponse | null {
    try {
      return this.payouts.getPayoutByExternalId(externalId);
    } catch {
      return null;
    }
  }

  private matchesChainFlowLookup(
    payout: PayoutResponse,
    identifiers: string[],
  ): boolean {
    const chainFlow = this.chainFlowMetadata(payout);
    const candidates = [
      payout.externalId,
      payout.chainFlowRequestId,
      chainFlow.tcTransaccionExterna,
      chainFlow.tnRetiroPago,
      chainFlow.tnTransferenciaBloque,
    ]
      .map((value) => this.normalizeIdentifier(value))
      .filter((value): value is string => Boolean(value));

    return candidates.some((candidate) => identifiers.includes(candidate));
  }

  private chainFlowMetadata(payout: PayoutResponse): Record<string, unknown> {
    return this.asRecord(payout.metadata.chainFlow);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private compactRecord(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => {
        if (value === null || value === undefined) return false;
        return typeof value !== 'string' || value.trim().length > 0;
      }),
    );
  }

  private normalizeIdentifier(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  private assetCode(asset: SettlementAsset): 1 | 2 {
    return asset === 'USDC' ? 1 : 2;
  }

  private toChainFlowStatus(status: PayoutResponse['status']): string {
    const statuses: Record<PayoutResponse['status'], string> = {
      prepared: 'PREPARADO',
      authorized: 'AUTORIZADO',
      broadcasted: 'ENVIADO_ONCHAIN',
      confirmed: 'CONFIRMADO',
      failed: 'FALLIDO',
    };

    return statuses[status];
  }
}
