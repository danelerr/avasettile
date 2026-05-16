import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuditActor } from '../audit/audit.types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
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
  ) {}

  async createPayout(
    dto: CreatePayoutDto,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const existing = this.ledger.findByExternalId(dto.externalId);
    if (existing) {
      this.audit.record({
        type: 'PAYOUT_IDEMPOTENT_REPLAY',
        subjectId: existing.id,
        actor: this.toAuditActor(context),
        payload: { externalId: dto.externalId },
      });
      return this.toResponse(existing, true);
    }

    const assetConfig = this.configuration.getAssetConfig(dto.asset);
    const amountAtomic = this.blockchain.toAtomicAmount(dto.asset, dto.amount);
    const now = new Date().toISOString();
    const record = this.ledger.create({
      id: randomUUID(),
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

    this.audit.record({
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

  listPayouts(query: ListPayoutsQueryDto): PayoutResponse[] {
    return this.ledger.list(query).map((record) => this.toResponse(record));
  }

  getPayout(id: string): PayoutResponse {
    const payout = this.requirePayout(id);
    return this.toResponse(payout);
  }

  getPayoutByExternalId(externalId: string): PayoutResponse {
    const payout = this.ledger.findByExternalId(externalId);
    if (!payout) throw new NotFoundException('Payout not found.');
    return this.toResponse(payout);
  }

  async authorizePayout(
    id: string,
    dto: AuthorizePayoutDto,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = this.requirePayout(id);
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
    const authorized = this.ledger.update(id, {
      status: PayoutStatus.Authorized,
      authorizedAt: now,
    })!;

    this.audit.record({
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
      const updated = this.ledger.update(id, {
        status,
        transactionHash: transfer.hash,
        broadcastedAt: now,
        confirmedAt: status === PayoutStatus.Confirmed ? now : null,
        failureReason: null,
      })!;

      this.audit.record({
        type:
          status === PayoutStatus.Confirmed
            ? 'PAYOUT_CONFIRMED'
            : 'PAYOUT_BROADCASTED',
        subjectId: id,
        actor: this.toAuditActor(context, dto.approvedBy),
        payload: { transactionHash: transfer.hash },
      });

      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof ConflictException) {
        this.ledger.update(id, {
          status: PayoutStatus.Prepared,
          failureReason: error.message,
        });
        throw error;
      }

      const failureReason =
        error instanceof Error ? error.message : 'Unknown broadcast failure.';
      const failed = this.ledger.update(id, {
        status: PayoutStatus.Failed,
        failureReason,
      })!;

      this.audit.record({
        type: 'PAYOUT_FAILED',
        subjectId: id,
        actor: this.toAuditActor(context, dto.approvedBy),
        payload: { failureReason },
      });

      throw new BadGatewayException({
        message: 'Failed to broadcast payout on Avalanche.',
        payout: this.toResponse(failed),
      });
    }
  }

  async reconcilePayout(
    id: string,
    context: RequestContext,
  ): Promise<PayoutResponse> {
    const payout = this.requirePayout(id);
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

    const updated = this.ledger.update(id, {
      status,
      confirmedAt,
      failureReason,
    })!;

    this.audit.record({
      type: 'PAYOUT_RECONCILED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: reconciliation,
    });

    return this.toResponse(updated);
  }

  private requirePayout(id: string): PayoutRecord {
    const payout = this.ledger.findById(id);
    if (!payout) throw new NotFoundException('Payout not found.');
    return payout;
  }

  private toResponse(
    record: PayoutRecord,
    idempotentReplay = false,
  ): PayoutResponse {
    return {
      ...record,
      idempotentReplay: idempotentReplay || undefined,
      auditTrail: this.audit.listBySubject(record.id).map((event) => ({
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
      institutionId: context.institutionId,
      actor: overrideActor ?? context.actor,
      correlationId: context.correlationId,
      sourceIp: context.sourceIp,
    };
  }
}
