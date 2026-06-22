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

    // Claim the authorization with a guarded transition: only one of any
    // concurrent requests can move prepared → authorized, so the ERC-20
    // transfer below can never be broadcast twice for the same payout.
    const now = new Date().toISOString();
    const authorized = await this.ledger.update(
      id,
      { status: PayoutStatus.Authorized, authorizedAt: now },
      { expectedStatus: [PayoutStatus.Prepared] },
    );

    if (!authorized) {
      const current = await this.requirePayout(id, context);
      if (
        current.status === PayoutStatus.Authorized ||
        current.status === PayoutStatus.Broadcasted ||
        current.status === PayoutStatus.Confirmed
      ) {
        return this.toResponse(current, true);
      }
      throw new ConflictException(
        `Payout cannot be authorized from status ${current.status}.`,
      );
    }

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

      // When a SettlementVault is configured, payouts route through it: the
      // operator key executes and funds pull from the funder treasury (which
      // only ever grants an allowance). Otherwise, a direct treasury transfer.
      const transfer = this.configuration.settlementVaultConfigured
        ? await this.blockchain.vaultPayout({
            asset: authorized.asset,
            payoutRef: this.blockchain.vaultPayoutRefFromExternalId(
              authorized.externalId,
            ),
            to: authorized.beneficiaryAddress,
            amountAtomic: BigInt(authorized.amountAtomic),
          })
        : await this.blockchain.sendErc20Transfer({
            asset: authorized.asset,
            to: authorized.beneficiaryAddress,
            amountAtomic: BigInt(authorized.amountAtomic),
          });
      const status =
        transfer.status === 'confirmed'
          ? PayoutStatus.Confirmed
          : PayoutStatus.Broadcasted;
      const updated = (await this.ledger.update(
        id,
        {
          status,
          transactionHash: transfer.hash,
          broadcastedAt: now,
          confirmedAt: status === PayoutStatus.Confirmed ? now : null,
          failureReason: null,
        },
        { expectedStatus: [PayoutStatus.Authorized] },
      ))!;

      await this.audit.record({
        type:
          status === PayoutStatus.Confirmed
            ? 'PAYOUT_CONFIRMED'
            : 'PAYOUT_BROADCASTED',
        subjectId: id,
        actor: this.toAuditActor(context, dto.approvedBy),
        payload: {
          transactionHash: transfer.hash,
          rail: this.configuration.settlementVaultConfigured
            ? 'vault'
            : 'direct',
        },
      });

      if (status === PayoutStatus.Confirmed) {
        await this.webhook.enqueue(updated.clientId, 'payout.confirmed', {
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
        await this.ledger.update(
          id,
          { status: PayoutStatus.Prepared, failureReason: error.message },
          { expectedStatus: [PayoutStatus.Authorized] },
        );
        throw error;
      }

      const failureReason =
        error instanceof Error ? error.message : 'Unknown broadcast failure.';
      const failed = (await this.ledger.update(
        id,
        { status: PayoutStatus.Failed, failureReason },
        { expectedStatus: [PayoutStatus.Authorized] },
      ))!;

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

  /**
   * Authorize a set of prepared payouts of the same asset and settle them in a
   * single atomic SettlementVault batch: either every leg pays or the whole
   * transaction reverts. Each payout is claimed prepared → authorized first
   * (so concurrent single-authorize requests can't double-spend), then a
   * deterministic batchRef gives on-chain replay protection.
   */
  async authorizePayoutBatch(
    payoutIds: string[],
    dto: AuthorizePayoutDto,
    context: RequestContext,
  ): Promise<PayoutResponse[]> {
    if (!this.configuration.settlementVaultConfigured) {
      throw new BadRequestException(
        'Batch payouts require the SettlementVault (set AVASETTLE_SETTLEMENT_VAULT_ADDRESS).',
      );
    }

    const ids = [...new Set(payoutIds)];
    if (ids.length === 0) {
      throw new BadRequestException('No payout ids provided.');
    }

    const payouts = await Promise.all(
      ids.map((id) => this.requirePayout(id, context)),
    );

    const asset = payouts[0].asset;
    if (payouts.some((p) => p.asset !== asset)) {
      throw new BadRequestException(
        'All payouts in a batch must use the same asset.',
      );
    }

    const notPrepared = payouts.filter(
      (p) => p.status !== PayoutStatus.Prepared,
    );
    if (notPrepared.length > 0) {
      throw new ConflictException(
        `Payouts must be prepared to batch-authorize: ${notPrepared
          .map((p) => p.id)
          .join(', ')} are not.`,
      );
    }

    const totalAtomic = payouts.reduce(
      (sum, p) => sum + BigInt(p.amountAtomic),
      0n,
    );
    const treasuryBalance = await this.blockchain.getAssetBalance(asset);
    if (BigInt(treasuryBalance.balanceAtomic) < totalAtomic) {
      throw new ConflictException(
        `Insufficient treasury ${asset} balance for the batch.`,
      );
    }

    // Claim every leg prepared → authorized. If any claim loses a race, roll the
    // already-claimed legs back so the batch stays all-or-nothing.
    const now = new Date().toISOString();
    const claimed: PayoutRecord[] = [];
    for (const payout of payouts) {
      const authorized = await this.ledger.update(
        payout.id,
        { status: PayoutStatus.Authorized, authorizedAt: now },
        { expectedStatus: [PayoutStatus.Prepared] },
      );
      if (!authorized) {
        await Promise.all(
          claimed.map((c) =>
            this.ledger.update(
              c.id,
              { status: PayoutStatus.Prepared },
              { expectedStatus: [PayoutStatus.Authorized] },
            ),
          ),
        );
        throw new ConflictException(
          `Payout ${payout.id} could not be claimed for the batch (concurrent change).`,
        );
      }
      claimed.push(authorized);
    }

    await Promise.all(
      claimed.map((c) =>
        this.audit.record({
          type: 'PAYOUT_AUTHORIZED',
          subjectId: c.id,
          actor: this.toAuditActor(context, dto.approvedBy),
          payload: {
            batch: true,
            riskDecisionId: dto.riskDecisionId ?? null,
            notes: dto.notes ?? null,
          },
        }),
      ),
    );

    try {
      const exec = await this.blockchain.vaultPayoutBatch({
        asset,
        batchRef: this.blockchain.batchRefFromExternalIds(
          claimed.map((c) => c.externalId),
        ),
        recipients: claimed.map((c) => c.beneficiaryAddress),
        amountsAtomic: claimed.map((c) => BigInt(c.amountAtomic)),
      });
      const status =
        exec.status === 'confirmed'
          ? PayoutStatus.Confirmed
          : PayoutStatus.Broadcasted;

      const updated = await Promise.all(
        claimed.map(
          (c) =>
            this.ledger.update(
              c.id,
              {
                status,
                transactionHash: exec.hash,
                broadcastedAt: now,
                confirmedAt: status === PayoutStatus.Confirmed ? now : null,
                failureReason: null,
              },
              { expectedStatus: [PayoutStatus.Authorized] },
            ) as Promise<PayoutRecord>,
        ),
      );

      for (const u of updated) {
        await this.audit.record({
          type:
            status === PayoutStatus.Confirmed
              ? 'PAYOUT_CONFIRMED'
              : 'PAYOUT_BROADCASTED',
          subjectId: u.id,
          actor: this.toAuditActor(context, dto.approvedBy),
          payload: { transactionHash: exec.hash, rail: 'vault', batch: true },
        });
        if (status === PayoutStatus.Confirmed) {
          await this.webhook.enqueue(u.clientId, 'payout.confirmed', {
            id: u.id,
            externalId: u.externalId,
            asset: u.asset,
            amount: u.amount,
            beneficiaryAddress: u.beneficiaryAddress,
            transactionHash: u.transactionHash,
            confirmedAt: u.confirmedAt,
          });
        }
      }

      return Promise.all(updated.map((u) => this.toResponse(u)));
    } catch (error) {
      // The vault batch is atomic, so on any failure nothing was paid. A
      // ConflictException (e.g. allowance shortfall) is retryable → back to
      // prepared; anything else is a hard failure.
      const retryable = error instanceof ConflictException;
      const failureReason =
        error instanceof Error
          ? error.message
          : 'Unknown batch broadcast failure.';

      await Promise.all(
        claimed.map((c) =>
          this.ledger.update(
            c.id,
            {
              status: retryable ? PayoutStatus.Prepared : PayoutStatus.Failed,
              failureReason,
            },
            { expectedStatus: [PayoutStatus.Authorized] },
          ),
        ),
      );

      if (retryable) throw error;

      await Promise.all(
        claimed.map((c) =>
          this.audit.record({
            type: 'PAYOUT_FAILED',
            subjectId: c.id,
            actor: this.toAuditActor(context, dto.approvedBy),
            payload: { failureReason, batch: true },
          }),
        ),
      );

      throw new BadGatewayException({
        message: 'Failed to broadcast batch payout on Avalanche.',
        failureReason,
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
