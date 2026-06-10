import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { formatEther, formatUnits, parseEther } from 'viem';
import { AuditService } from '../audit/audit.service';
import { AuditActor } from '../audit/audit.types';
import { parseAtomicAmount } from '../blockchain/amount.utils';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { AssetRuntimeConfig } from '../configuration/configuration.types';
import { DatabaseService } from '../database/database.service';
import { RequestContext } from '../payouts/payout.types';
import { WebhookService } from '../webhooks/webhook.service';
import { AcceptPayInDto } from './dto/accept-payin.dto';
import { CreatePayInDto } from './dto/create-payin.dto';
import { ListPayInsQueryDto } from './dto/list-payins-query.dto';
import { SweepPayInDto } from './dto/sweep-payin.dto';
import { TopUpAndSweepDto } from './dto/topup-and-sweep.dto';
import { TopUpPayInDto } from './dto/topup-payin.dto';
import { PayInLedgerService } from './payin-ledger.service';
import {
  PayInCollectionMode,
  PayInRecord,
  PayInResponse,
  PayInStatus,
  PayInSweepStatus,
  PayInTransferRecord,
} from './payins.types';

@Injectable()
export class PayinsService {
  private readonly logger = new Logger(PayinsService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
    private readonly ledger: PayInLedgerService,
    private readonly webhook: WebhookService,
  ) {}

  async createPayIn(
    dto: CreatePayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    // Idempotency key: if the same key was used in a prior request, return that result.
    if (context.idempotencyKey) {
      const prior = await this.ledger.findByIdempotencyKey(
        context.clientId,
        context.idempotencyKey,
      );
      if (prior) return this.toResponse(prior, true);
    }

    const assetConfig = this.configuration.getAssetConfig(dto.asset);
    const expectedAmountAtomic = this.parseAmount(dto.amount, assetConfig);

    const collectionMode =
      dto.collectionMode ?? PayInCollectionMode.DerivedAddress;
    const isRouterMode = collectionMode === PayInCollectionMode.PaymentRouter;
    const routerAddress = isRouterMode
      ? this.requirePaymentRouterAddress()
      : null;
    const routerInvoiceId = isRouterMode
      ? (dto.routerInvoiceId ??
        this.blockchain.routerInvoiceIdFromExternalId(dto.externalId))
      : null;

    const startBlock = await this.blockchain.getLatestBlockNumber();
    const now = new Date();
    const expirationMinutes =
      dto.expiresInMinutes ?? this.configuration.payInDefaultExpirationMinutes;
    const expiresAt = expirationMinutes
      ? new Date(now.getTime() + expirationMinutes * 60_000).toISOString()
      : null;

    // The SQL counter is claimed atomically so concurrent instances never
    // derive the same address. A claimed index is discarded (never reused)
    // when the externalId turns out to already exist.
    const derivationIndex = isRouterMode
      ? -1
      : await this.database.claimNextPayInIndex();
    const depositAddress: `0x${string}` =
      routerAddress ?? this.blockchain.derivePayInAddress(derivationIndex);

    const { record, existed } = await this.ledger.createOrGetExisting({
      id: randomUUID(),
      clientId: context.clientId,
      externalId: dto.externalId,
      chainFlowRequestId: dto.chainFlowRequestId ?? null,
      status: PayInStatus.Pending,
      network: this.configuration.settlementNetwork,
      chainId: this.configuration.networkSummary.chainId,
      asset: dto.asset,
      tokenAddress: assetConfig.address!,
      expectedAmount: dto.amount,
      expectedAmountAtomic: expectedAmountAtomic.toString(),
      receivedAmount: '0',
      receivedAmountAtomic: '0',
      depositAddress,
      derivationIndex,
      collectionMode,
      routerAddress,
      routerInvoiceId,
      startBlock: startBlock.toString(),
      expiresAt,
      metadata: dto.metadata ?? {},
      transfers: [],
      sweepStatus: isRouterMode
        ? PayInSweepStatus.NotRequired
        : PayInSweepStatus.Pending,
      sweepTransactionHash: null,
      sweptAmount: '0',
      sweptAmountAtomic: '0',
      sweptAt: null,
      sweepFailureReason: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      detectedAt: null,
      confirmedAt: null,
      acceptedAt: null,
      acceptanceNote: null,
    });

    if (existed) return this.toResponse(record, true);

    if (context.idempotencyKey) {
      await this.ledger.storeIdempotencyKey(
        context.clientId,
        context.idempotencyKey,
        record.id,
      );
    }

    await this.audit.record({
      type: 'PAYIN_CREATED',
      subjectId: record.id,
      actor: this.toAuditActor(context),
      payload: {
        externalId: record.externalId,
        depositAddress: record.depositAddress,
        derivationIndex: record.derivationIndex,
        collectionMode: record.collectionMode,
        routerInvoiceId: record.routerInvoiceId,
        expectedAmount: record.expectedAmount,
        asset: record.asset,
      },
    });

    return this.toResponse(record);
  }

  async listPayIns(
    query: ListPayInsQueryDto,
    context: RequestContext,
  ): Promise<PayInResponse[]> {
    const records = await this.ledger.list({
      ...query,
      clientId: context.clientId ?? undefined,
    });
    return Promise.all(records.map((record) => this.toResponse(record)));
  }

  async getPayIn(id: string, context: RequestContext): Promise<PayInResponse> {
    return this.toResponse(await this.requirePayIn(id, context));
  }

  async reconcilePayIn(
    id: string,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = await this.requirePayIn(id, context);
    if (payin.status === PayInStatus.Confirmed) {
      return this.toResponse(payin, true);
    }

    const [transfers, latestBlock] = await Promise.all([
      this.findPayInTransfers(payin),
      this.blockchain.getLatestBlockNumber(),
    ]);
    const totalReceivedAtomic = transfers.reduce(
      (sum, transfer) => sum + BigInt(transfer.amountAtomic),
      0n,
    );
    const expectedAtomic = BigInt(payin.expectedAmountAtomic);
    const assetConfig = this.configuration.getAssetConfig(payin.asset);
    const now = new Date().toISOString();
    const latestTransferBlock = transfers.reduce<bigint | null>(
      (latest, transfer) => {
        const block = BigInt(transfer.blockNumber);
        return latest === null || block > latest ? block : latest;
      },
      null,
    );
    const enoughConfirmations =
      latestTransferBlock !== null &&
      latestBlock > latestTransferBlock &&
      Number(latestBlock - latestTransferBlock) >=
        this.configuration.minConfirmations;
    const expired =
      Boolean(payin.expiresAt) &&
      new Date(payin.expiresAt!).getTime() < Date.now();

    let status: PayInStatus = payin.status;
    if (totalReceivedAtomic === 0n) {
      status = expired ? PayInStatus.Expired : PayInStatus.Pending;
    } else if (totalReceivedAtomic < expectedAtomic) {
      status = PayInStatus.Underpaid;
    } else if (totalReceivedAtomic > expectedAtomic) {
      status = PayInStatus.Overpaid;
    } else {
      status = enoughConfirmations
        ? PayInStatus.Confirmed
        : PayInStatus.Detected;
    }

    const isFirstDetection = transfers.length > 0 && !payin.detectedAt;
    const isNewConfirmation =
      status === PayInStatus.Confirmed && !payin.confirmedAt;

    const updated = await this.ledger.update(id, {
      status,
      receivedAmountAtomic: totalReceivedAtomic.toString(),
      receivedAmount: formatUnits(totalReceivedAtomic, assetConfig.decimals),
      transfers,
      detectedAt: isFirstDetection ? now : payin.detectedAt,
      confirmedAt: isNewConfirmation ? now : payin.confirmedAt,
    });
    if (!updated) throw new ConflictException('Unable to update pay-in.');

    await this.audit.record({
      type: 'PAYIN_RECONCILED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        status,
        receivedAmountAtomic: totalReceivedAtomic.toString(),
        transferCount: transfers.length,
      },
    });

    if (isFirstDetection) {
      void this.webhook.fire(updated.clientId, 'payin.detected', {
        id: updated.id,
        externalId: updated.externalId,
        asset: updated.asset,
        depositAddress: updated.depositAddress,
        receivedAmount: updated.receivedAmount,
        expectedAmount: updated.expectedAmount,
        detectedAt: updated.detectedAt,
      });
    }

    if (isNewConfirmation) {
      void this.webhook.fire(updated.clientId, 'payin.confirmed', {
        id: updated.id,
        externalId: updated.externalId,
        asset: updated.asset,
        receivedAmount: updated.receivedAmount,
        depositAddress: updated.depositAddress,
        confirmedAt: updated.confirmedAt,
      });

      if (
        this.configuration.autoSweep &&
        payin.collectionMode !== PayInCollectionMode.PaymentRouter
      ) {
        void this.topUpAndSweep(id, {}, context).catch((error: unknown) => {
          this.logger.warn(
            `Auto-sweep failed for pay-in ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        });
      }
    }

    return this.toResponse(updated);
  }

  async sweepPayIn(
    id: string,
    dto: SweepPayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = await this.requirePayIn(id, context);
    if (payin.collectionMode === PayInCollectionMode.PaymentRouter) {
      const updated = await this.ledger.update(id, {
        sweepStatus: PayInSweepStatus.NotRequired,
        sweepFailureReason: null,
      });
      if (!updated) throw new ConflictException('Unable to update pay-in.');
      return this.toResponse(updated, true);
    }

    if (
      payin.sweepStatus === PayInSweepStatus.Broadcasted ||
      payin.sweepStatus === PayInSweepStatus.Confirmed
    ) {
      return this.toResponse(payin, true);
    }

    const assetConfig = this.configuration.getAssetConfig(payin.asset);
    const amountAtomic = dto.amount
      ? this.parseAmount(dto.amount, assetConfig)
      : undefined;

    try {
      const sweep = await this.blockchain.sweepDerivedPayIn({
        asset: payin.asset,
        derivationIndex: payin.derivationIndex,
        expectedAddress: payin.depositAddress,
        amountAtomic,
      });
      const sweepStatus =
        sweep.status === 'confirmed'
          ? PayInSweepStatus.Confirmed
          : PayInSweepStatus.Broadcasted;
      const updated = await this.ledger.update(id, {
        sweepStatus,
        sweepTransactionHash: sweep.hash,
        sweptAmount: sweep.amount,
        sweptAmountAtomic: sweep.amountAtomic,
        sweptAt: new Date().toISOString(),
        sweepFailureReason: null,
      });
      if (!updated) throw new ConflictException('Unable to update pay-in.');

      await this.audit.record({
        type: 'PAYIN_SWEPT',
        subjectId: id,
        actor: this.toAuditActor(context),
        payload: {
          transactionHash: sweep.hash,
          from: sweep.from,
          to: sweep.to,
          amount: sweep.amount,
          amountAtomic: sweep.amountAtomic,
          notes: dto.notes ?? null,
        },
      });

      return this.toResponse(updated);
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Unknown sweep failure.';
      const failed = await this.ledger.update(id, {
        sweepStatus: PayInSweepStatus.Failed,
        sweepFailureReason: failureReason,
      });

      await this.audit.record({
        type: 'PAYIN_SWEEP_FAILED',
        subjectId: id,
        actor: this.toAuditActor(context),
        payload: { failureReason, notes: dto.notes ?? null },
      });

      if (failed) return this.toResponse(failed);
      throw error;
    }
  }

  async acceptPayIn(
    id: string,
    dto: AcceptPayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = await this.requirePayIn(id, context);
    if (
      payin.status !== PayInStatus.Underpaid &&
      payin.status !== PayInStatus.Overpaid
    ) {
      throw new ConflictException(
        `Pay-in cannot be accepted from status "${payin.status}". Only underpaid or overpaid pay-ins can be manually accepted.`,
      );
    }

    const now = new Date().toISOString();
    const updated = await this.ledger.update(id, {
      status: PayInStatus.Confirmed,
      acceptedAt: now,
      acceptanceNote: dto.note ?? null,
      confirmedAt: payin.confirmedAt ?? now,
    });
    if (!updated) throw new ConflictException('Unable to update pay-in.');

    await this.audit.record({
      type: 'PAYIN_ACCEPTED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        previousStatus: payin.status,
        receivedAmount: payin.receivedAmount,
        expectedAmount: payin.expectedAmount,
        note: dto.note ?? null,
      },
    });

    void this.webhook.fire(updated.clientId, 'payin.confirmed', {
      id: updated.id,
      externalId: updated.externalId,
      asset: updated.asset,
      receivedAmount: updated.receivedAmount,
      depositAddress: updated.depositAddress,
      confirmedAt: updated.confirmedAt,
      acceptedManually: true,
    });

    return this.toResponse(updated);
  }

  async topUpPayIn(
    id: string,
    dto: TopUpPayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = await this.requirePayIn(id, context);
    if (payin.collectionMode === PayInCollectionMode.PaymentRouter) {
      throw new BadRequestException(
        'PaymentRouter pay-ins do not require gas top-up — the payer funds the gas.',
      );
    }

    const amountWei = dto.amountAvax
      ? parseEther(dto.amountAvax)
      : parseEther('0.002');

    const transfer = await this.blockchain.sendNativeTransfer(
      payin.depositAddress,
      amountWei,
    );

    await this.audit.record({
      type: 'PAYIN_TOPUP',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        depositAddress: payin.depositAddress,
        amountAvax: formatEther(amountWei),
        transactionHash: transfer.hash,
        status: transfer.status,
      },
    });

    return this.toResponse(payin);
  }

  async topUpAndSweep(
    id: string,
    dto: TopUpAndSweepDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = await this.requirePayIn(id, context);
    if (payin.collectionMode === PayInCollectionMode.PaymentRouter) {
      throw new BadRequestException(
        'PaymentRouter pay-ins route directly to treasury — no top-up or sweep needed.',
      );
    }

    const amountWei = dto.amountAvax
      ? parseEther(dto.amountAvax)
      : parseEther('0.002');

    // Always wait for the top-up to land before attempting the sweep.
    const topup = await this.blockchain.sendNativeTransfer(
      payin.depositAddress,
      amountWei,
    );

    await this.audit.record({
      type: 'PAYIN_TOPUP',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        depositAddress: payin.depositAddress,
        amountAvax: formatEther(amountWei),
        transactionHash: topup.hash,
        status: topup.status,
      },
    });

    if (topup.status === 'broadcasted') {
      await this.blockchain.waitForTransaction(topup.hash);
    }

    return this.sweepPayIn(id, { notes: dto.notes }, context);
  }

  private async findPayInTransfers(
    payin: PayInRecord,
  ): Promise<PayInTransferRecord[]> {
    if (payin.collectionMode === PayInCollectionMode.PaymentRouter) {
      if (!payin.routerInvoiceId) {
        throw new BadRequestException('Router pay-in has no invoice id.');
      }

      return this.blockchain
        .findPaymentRouterInvoicePayments({
          asset: payin.asset,
          invoiceId: payin.routerInvoiceId,
          fromBlock: BigInt(payin.startBlock),
        })
        .then((payments) =>
          payments.map((payment) => ({
            hash: payment.hash,
            from: payment.from,
            to: payment.to,
            amount: payment.amount,
            amountAtomic: payment.amountAtomic,
            blockNumber: payment.blockNumber,
          })),
        );
    }

    return this.blockchain.findIncomingErc20Transfers({
      asset: payin.asset,
      to: payin.depositAddress,
      fromBlock: BigInt(payin.startBlock),
    });
  }

  private async requirePayIn(
    id: string,
    context: RequestContext,
  ): Promise<PayInRecord> {
    const payin = await this.ledger.findById(id, context.clientId ?? undefined);
    if (!payin) throw new NotFoundException('Pay-in not found.');
    return payin;
  }

  private requirePaymentRouterAddress(): `0x${string}` {
    const address = this.configuration.paymentRouterAddress;
    if (!address) {
      throw new ServiceUnavailableException(
        'AVASETTLE_PAYMENT_ROUTER_ADDRESS is required for payment-router pay-ins.',
      );
    }

    return address;
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
    record: PayInRecord,
    idempotentReplay = false,
  ): Promise<PayInResponse> {
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

  private toAuditActor(context: RequestContext): AuditActor {
    return {
      clientId: context.clientId,
      actor: context.actor,
      correlationId: context.correlationId,
      sourceIp: context.sourceIp,
    };
  }
}
