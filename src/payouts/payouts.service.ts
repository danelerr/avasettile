import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuditActor } from '../audit/audit.types';
import { parseAtomicAmount } from '../blockchain/amount.utils';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { AssetRuntimeConfig } from '../configuration/configuration.types';
import { WebhookService } from '../webhooks/webhook.service';
import { AuthorizePayoutDto } from './dto/authorize-payout.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { PayoutLedgerService } from './payout-ledger.service';
import {
  PayoutRecord,
  PayoutResponse,
  PayoutStatus,
  RequestContext,
} from './payout.types';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly audit: AuditService,
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
    private readonly ledger: PayoutLedgerService,
    private readonly webhook: WebhookService,
  ) {}

  async createPayout(
    dto: CreatePayoutDto,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const assetConfig = this.configuration.getAssetConfig(dto.asset);
    const amountAtomic = this.parseAmount(dto.amount, assetConfig);

    if (assetConfig.maxPayoutAmount) {
      const maxAtomic = parseAtomicAmount(
        assetConfig.maxPayoutAmount,
        assetConfig.decimals,
      );
      if (amountAtomic > maxAtomic) {
        throw new BadRequestException(
          `Payout exceeds configured max for ${dto.asset}.`,
        );
      }
    }

    const now = new Date().toISOString();
    const { record, existed } = await this.ledger.createOrGetExisting({
      id: randomUUID(),
      clientId: context.clientId,
      externalId: dto.externalId,
      chainFlowRequestId: dto.chainFlowRequestId ?? null,
      status: PayoutStatus.Prepared,
      network: this.configuration.settlementNetwork,
      chainId: this.configuration.networkSummary.chainId,
      asset: dto.asset,
      tokenAddress: assetConfig.address!,
      amount: dto.amount,
      amountAtomic: amountAtomic.toString(),
      beneficiaryAddress: dto.beneficiaryAddress,
      beneficiaryName: dto.beneficiaryName ?? null,
      treasuryAddress: this.blockchain.treasuryAddress,
      transactionHash: null,
      failureReason: null,
      memo: dto.memo ?? null,
      metadata: dto.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      authorizedAt: null,
      broadcastedAt: null,
      confirmedAt: null,
    });

    if (existed) {
      await this.audit.record({
        type: 'PAYOUT_IDEMPOTENT_REPLAY',
        subjectId: record.id,
        actor: this.toAuditActor(context),
        payload: { externalId: dto.externalId },
      });
      return this.toResponse(record, true);
    }

    await this.audit.record({
      type: 'PAYOUT_PREPARED',
      subjectId: record.id,
      actor: this.toAuditActor(context),
      payload: {
        externalId: record.externalId,
        amount: record.amount,
        asset: record.asset,
        beneficiaryAddress: record.beneficiaryAddress,
      },
    });

    if (dto.executeImmediately) {
      return this.authorizePayout(record.id, {}, context);
    }

    return this.toResponse(record);
  }

  async listPayouts(
    query: ListPayoutsQueryDto,
    context: RequestContext,
  ): Promise<PayoutResponse[]> {
    const records = await this.ledger.list({
      ...query,
      clientId: context.clientId ?? undefined,
    });
    return Promise.all(records.map((record) => this.toResponse(record)));
  }

  async getPayout(
    id: string,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = await this.requirePayout(id, context);
    return this.toResponse(payout);
  }

  async getPayoutByExternalId(
    externalId: string,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = await this.ledger.findByExternalId(
      context.clientId,
      externalId,
    );
    if (!payout) throw new NotFoundException('Payout not found.');
    return this.toResponse(payout);
  }

  async authorizePayout(
    id: string,
    dto: AuthorizePayoutDto,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = await this.requirePayout(id, context);
    if (
      payout.status === PayoutStatus.Broadcasted ||
      payout.status === PayoutStatus.Confirmed
    ) {
      return this.toResponse(payout, true);
    }

    if (payout.status !== PayoutStatus.Prepared) {
      throw new ConflictException(
        `Payout cannot be authorized from status ${payout.status}.`,
      );
    }

    const now = new Date().toISOString();
    const authorized = (await this.ledger.update(id, {
      status: PayoutStatus.Authorized,
      authorizedAt: now,
    }))!;

    await this.audit.record({
      type: 'PAYOUT_AUTHORIZED',
      subjectId: id,
      actor: this.toAuditActor(context, dto.approvedBy),
      payload: {
        riskDecisionId: dto.riskDecisionId ?? null,
        notes: dto.notes ?? null,
      },
    });

    try {
      const treasuryBalance = await this.blockchain.getAssetBalance(
        authorized.asset,
      );
      if (
        BigInt(treasuryBalance.balanceAtomic) < BigInt(authorized.amountAtomic)
      ) {
        throw new ConflictException(
          `Insufficient treasury ${authorized.asset} balance.`,
        );
      }

      const transfer = await this.blockchain.sendErc20Transfer({
        asset: authorized.asset,
        to: authorized.beneficiaryAddress,
        amountAtomic: BigInt(authorized.amountAtomic),
      });
      const status =
        transfer.status === 'confirmed'
          ? PayoutStatus.Confirmed
          : PayoutStatus.Broadcasted;
      const updated = (await this.ledger.update(id, {
        status,
        transactionHash: transfer.hash,
        broadcastedAt: now,
        confirmedAt: status === PayoutStatus.Confirmed ? now : null,
        failureReason: null,
      }))!;

      await this.audit.record({
        type:
          status === PayoutStatus.Confirmed
            ? 'PAYOUT_CONFIRMED'
            : 'PAYOUT_BROADCASTED',
        subjectId: id,
        actor: this.toAuditActor(context, dto.approvedBy),
        payload: { transactionHash: transfer.hash },
      });

      if (status === PayoutStatus.Confirmed) {
        void this.webhook.fire(updated.clientId, 'payout.confirmed', {
          id: updated.id,
          externalId: updated.externalId,
          asset: updated.asset,
          amount: updated.amount,
          beneficiaryAddress: updated.beneficiaryAddress,
          transactionHash: updated.transactionHash,
          confirmedAt: updated.confirmedAt,
        });
      }

      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof ConflictException) {
        await this.ledger.update(id, {
          status: PayoutStatus.Prepared,
          failureReason: error.message,
        });
        throw error;
      }

      const failureReason =
        error instanceof Error ? error.message : 'Unknown broadcast failure.';
      const failed = (await this.ledger.update(id, {
        status: PayoutStatus.Failed,
        failureReason,
      }))!;

      await this.audit.record({
        type: 'PAYOUT_FAILED',
        subjectId: id,
        actor: this.toAuditActor(context, dto.approvedBy),
        payload: { failureReason },
      });

      throw new BadGatewayException({
        message: 'Failed to broadcast payout on Avalanche.',
        payout: await this.toResponse(failed),
      });
    }
  }

  async reconcilePayout(
    id: string,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = await this.requirePayout(id, context);
    if (!payout.transactionHash) {
      throw new ConflictException(
        'Payout has no transaction hash to reconcile.',
      );
    }

    const reconciliation = await this.blockchain.reconcileTransaction(
      payout.transactionHash,
    );
    let status = payout.status;
    let confirmedAt = payout.confirmedAt;
    let failureReason = payout.failureReason;

    if (reconciliation.status === 'reverted') {
      status = PayoutStatus.Failed;
      failureReason = 'Transaction reverted on-chain.';
    }

    if (reconciliation.finalized) {
      status = PayoutStatus.Confirmed;
      confirmedAt = new Date().toISOString();
      failureReason = null;
    }

    const updated = (await this.ledger.update(id, {
      status,
      confirmedAt,
      failureReason,
    }))!;

    await this.audit.record({
      type: 'PAYOUT_RECONCILED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: reconciliation,
    });

    return this.toResponse(updated);
  }

  private async requirePayout(
    id: string,
    context: RequestContext,
  ): Promise<PayoutRecord> {
    const payout = await this.ledger.findById(
      id,
      context.clientId ?? undefined,
    );
    if (!payout) throw new NotFoundException('Payout not found.');
    return payout;
  }

  private parseAmount(amount: string, assetConfig: AssetRuntimeConfig): bigint {
    try {
      return parseAtomicAmount(amount, assetConfig.decimals);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid amount.',
      );
    }
  }

  private async toResponse(
    record: PayoutRecord,
    idempotentReplay = false,
  ): Promise<PayoutResponse> {
    const trail = await this.audit.listBySubject(record.id);
    return {
      ...record,
      idempotentReplay: idempotentReplay || undefined,
      auditTrail: trail.map((event) => ({
        type: event.type,
        createdAt: event.createdAt,
        correlationId: event.actor.correlationId,
      })),
    };
  }

  private toAuditActor(
    context: RequestContext,
    overrideActor?: string,
  ): AuditActor {
    return {
      clientId: context.clientId,
      actor: overrideActor ?? context.actor,
      correlationId: context.correlationId,
      sourceIp: context.sourceIp,
    };
  }
}
