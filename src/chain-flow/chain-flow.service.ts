import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthorizePayoutDto } from '../payouts/dto/authorize-payout.dto';
import { CreatePayoutDto } from '../payouts/dto/create-payout.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { PayoutResponse, RequestContext } from '../payouts/payout.types';
import { SettlementAsset } from '../configuration/configuration.types';
import {
  ChainFlowEstadoRetiroDto,
  ChainFlowRetiroDto,
} from './dto/chain-flow-retiro.dto';

@Injectable()
export class ChainFlowService {
  constructor(private readonly payouts: PayoutsService) {}

  async prepararRetiro(dto: ChainFlowRetiroDto, context: RequestContext) {
    const createDto = this.toCreatePayoutDto(dto);
    const payout = await this.payouts.createPayout(createDto, context);
    return this.toChainFlowResponse(payout, 'Retiro preparado.');
  }

  async autorizarRetiro(
    dto: ChainFlowEstadoRetiroDto,
    context: RequestContext,
  ) {
    const payout = await this.resolvePayout(dto, context);
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

  async consultarEstadoRetiro(
    dto: ChainFlowEstadoRetiroDto,
    context: RequestContext,
  ) {
    const payout = await this.resolvePayout(dto, context);
    return this.toChainFlowResponse(payout, 'Estado de retiro consultado.');
  }

  private async resolvePayout(
    dto: ChainFlowEstadoRetiroDto,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    if (dto.payoutId) return this.payouts.getPayout(dto.payoutId, context);

    // Try canonical identifiers in priority order
    const identifiers = [
      dto.tcTransaccionExterna,
      dto.externalId,
      dto.tnRetiroPago,
      dto.tnTransferenciaBloque,
    ]
      .map((v) => this.normalizeIdentifier(v))
      .filter((v): v is string => v !== null);

    if (identifiers.length === 0) {
      throw new BadRequestException(
        'payoutId, tcTransaccionExterna, externalId, tnRetiroPago or tnTransferenciaBloque is required.',
      );
    }

    for (const id of identifiers) {
      const payout = await this.tryGetPayoutByExternalId(id, context);
      if (payout) return payout;
    }

    // Fallback: scan metadata for a ChainFlow field match
    const payouts = await this.payouts.listPayouts({}, context);
    const payoutByMeta = payouts.find((p) =>
      this.matchesChainFlowLookup(p, identifiers),
    );
    if (payoutByMeta) return payoutByMeta;

    // Final throw via externalId (will 404 with a clean message)
    return this.payouts.getPayoutByExternalId(identifiers[0], context);
  }

  private toCreatePayoutDto(dto: ChainFlowRetiroDto): CreatePayoutDto {
    // Primary ChainFlow fields, then AvaSettle-compatible fallbacks
    const externalId = this.normalizeIdentifier(
      dto.tcTransaccionExterna ?? dto.externalId,
    );
    const amount = this.normalizeIdentifier(dto.tnMonto ?? dto.amount);
    const asset = this.resolveAsset(dto.tnMoneda ?? dto.asset);
    const beneficiaryAddress = dto.tcCuentaDestino ?? dto.beneficiaryAddress;
    const chainFlowRequestId = this.normalizeIdentifier(
      dto.tnRetiroPago ?? dto.tnTransferenciaBloque,
    );

    if (!externalId) {
      throw new BadRequestException(
        'tcTransaccionExterna or externalId is required.',
      );
    }
    if (!amount) {
      throw new BadRequestException('tnMonto or amount is required.');
    }
    if (!beneficiaryAddress) {
      throw new BadRequestException(
        'tcCuentaDestino or beneficiaryAddress is required.',
      );
    }

    const chainFlowMetadata = {
      ...this.asRecord((dto.metadata as Record<string, unknown>)?.chainFlow),
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
        ...(dto.metadata as Record<string, unknown>),
        source: 'chain-flow-compat',
        chainFlow: chainFlowMetadata,
      },
    };
  }

  private toChainFlowResponse(payout: PayoutResponse, mensaje: string) {
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
      estadoChainFlow: this.toChainFlowStatus(payout.status),
      txHash: payout.transactionHash,
      red: payout.network,
      chainId: payout.chainId,
      asset: payout.asset,
      monto: payout.amount,
      creadoEn: payout.createdAt,
      actualizadoEn: payout.updatedAt,
    };
  }

  private resolveAsset(rawAsset: unknown): SettlementAsset {
    const asset = this.normalizeIdentifier(rawAsset) ?? 'USDC';
    const normalized = asset.toUpperCase();

    if (normalized === '1') return 'USDC';
    if (normalized === '2') return 'USDT';
    if (normalized === 'USDC' || normalized === 'USDT') return normalized;

    throw new BadRequestException(
      'tnMoneda/asset must be 1 (USDC), 2 (USDT), USDC or USDT.',
    );
  }

  private async tryGetPayoutByExternalId(
    externalId: string,
    context: RequestContext,
  ): Promise<PayoutResponse | null> {
    try {
      return await this.payouts.getPayoutByExternalId(externalId, context);
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
      .map((v) => this.normalizeIdentifier(v))
      .filter((v): v is string => v !== null);

    return candidates.some((c) => identifiers.includes(c));
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
