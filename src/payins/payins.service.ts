import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { formatUnits } from 'viem';
import { AuditService } from '../audit/audit.service';
import { AuditActor } from '../audit/audit.types';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { CreatePayInDto } from './dto/create-payin.dto';
import { ListPayInsQueryDto } from './dto/list-payins-query.dto';
import { SweepPayInDto } from './dto/sweep-payin.dto';
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
  constructor(
    private readonly audit: AuditService,
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
    private readonly ledger: PayInLedgerService,
  ) {}

  async createPayIn(
    dto: CreatePayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const existing = this.ledger.findByExternalId(dto.externalId);
    if (existing) {
      return this.toResponse(existing, true);
    }

    const assetConfig = this.configuration.getAssetConfig(dto.asset);
    const expectedAmountAtomic = this.blockchain.toAtomicAmount(
      dto.asset,
      dto.amount,
    );
    const collectionMode =
      dto.collectionMode ?? PayInCollectionMode.DerivedAddress;
    const isRouterMode = collectionMode === PayInCollectionMode.PaymentRouter;
    const derivationIndex = isRouterMode
      ? -1
      : this.ledger.nextDerivationIndex();
    const routerAddress = isRouterMode
      ? this.requirePaymentRouterAddress()
      : null;
    const routerInvoiceId = isRouterMode
      ? (dto.routerInvoiceId ??
        this.blockchain.routerInvoiceIdFromExternalId(dto.externalId))
      : null;
    const depositAddress: `0x${string}` =
      routerAddress ?? this.blockchain.derivePayInAddress(derivationIndex);
    const startBlock = await this.blockchain.getLatestBlockNumber();
    const now = new Date();
    const expirationMinutes =
      dto.expiresInMinutes ?? this.configuration.payInDefaultExpirationMinutes;
    const record = this.ledger.create({
      id: randomUUID(),
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
      expiresAt: expirationMinutes
        ? new Date(now.getTime() + expirationMinutes * 60_000).toISOString()
        : null,
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
    });

    this.audit.record({
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

  listPayIns(query: ListPayInsQueryDto): PayInResponse[] {
    return this.ledger.list(query).map((record) => this.toResponse(record));
  }

  getPayIn(id: string): PayInResponse {
    return this.toResponse(this.requirePayIn(id));
  }

  async reconcilePayIn(
    id: string,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = this.requirePayIn(id);
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
      latestBlock >= latestTransferBlock &&
      Number(latestBlock - latestTransferBlock + 1n) >=
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

    const updated = this.ledger.update(id, {
      status,
      receivedAmountAtomic: totalReceivedAtomic.toString(),
      receivedAmount: formatUnits(totalReceivedAtomic, assetConfig.decimals),
      transfers,
      detectedAt:
        transfers.length > 0 && !payin.detectedAt ? now : payin.detectedAt,
      confirmedAt:
        status === PayInStatus.Confirmed && !payin.confirmedAt
          ? now
          : payin.confirmedAt,
    });
    if (!updated) throw new ConflictException('Unable to update pay-in.');

    this.audit.record({
      type: 'PAYIN_RECONCILED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        status,
        receivedAmountAtomic: totalReceivedAtomic.toString(),
        transferCount: transfers.length,
      },
    });

    return this.toResponse(updated);
  }

  async sweepPayIn(
    id: string,
    dto: SweepPayInDto,
    context: RequestContext,
  ): Promise<PayInResponse> {
    const payin = this.requirePayIn(id);
    if (payin.collectionMode === PayInCollectionMode.PaymentRouter) {
      const updated = this.ledger.update(id, {
        sweepStatus: PayInSweepStatus.NotRequired,
        sweepFailureReason: null,
      });
      if (!updated) throw new ConflictException('Unable to update pay-in.');
      return this.toResponse(updated, true);
    }

    if (payin.sweepStatus === PayInSweepStatus.Broadcasted) {
      return this.toResponse(payin, true);
    }
    if (payin.sweepStatus === PayInSweepStatus.Confirmed) {
      return this.toResponse(payin, true);
    }

    const amountAtomic = dto.amount
      ? this.blockchain.toAtomicAmount(payin.asset, dto.amount)
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
      const updated = this.ledger.update(id, {
        sweepStatus,
        sweepTransactionHash: sweep.hash,
        sweptAmount: sweep.amount,
        sweptAmountAtomic: sweep.amountAtomic,
        sweptAt: new Date().toISOString(),
        sweepFailureReason: null,
      });
      if (!updated) throw new ConflictException('Unable to update pay-in.');

      this.audit.record({
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
      const failed = this.ledger.update(id, {
        sweepStatus: PayInSweepStatus.Failed,
        sweepFailureReason: failureReason,
      });

      this.audit.record({
        type: 'PAYIN_SWEEP_FAILED',
        subjectId: id,
        actor: this.toAuditActor(context),
        payload: { failureReason, notes: dto.notes ?? null },
      });

      if (failed) return this.toResponse(failed);
      throw error;
    }
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

  private requirePayIn(id: string): PayInRecord {
    const payin = this.ledger.findById(id);
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

  private toResponse(
    record: PayInRecord,
    idempotentReplay = false,
  ): PayInResponse {
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

  private toAuditActor(context: RequestContext): AuditActor {
    return {
      institutionId: context.institutionId,
      actor: context.actor,
      correlationId: context.correlationId,
      sourceIp: context.sourceIp,
    };
  }
}
