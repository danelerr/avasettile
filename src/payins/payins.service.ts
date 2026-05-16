import {
  ConflictException,
  Injectable,
  NotFoundException,
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
import { PayInLedgerService } from './payin-ledger.service';
import { PayInRecord, PayInResponse, PayInStatus } from './payins.types';

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
    const derivationIndex = this.ledger.nextDerivationIndex();
    const depositAddress = this.blockchain.derivePayInAddress(derivationIndex);
    const startBlock = await this.blockchain.getLatestBlockNumber();
    const now = new Date();
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
      startBlock: startBlock.toString(),
      expiresAt: dto.expiresInMinutes
        ? new Date(now.getTime() + dto.expiresInMinutes * 60_000).toISOString()
        : null,
      metadata: dto.metadata ?? {},
      transfers: [],
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
      this.blockchain.findIncomingErc20Transfers({
        asset: payin.asset,
        to: payin.depositAddress,
        fromBlock: BigInt(payin.startBlock),
      }),
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

  private requirePayIn(id: string): PayInRecord {
    const payin = this.ledger.findById(id);
    if (!payin) throw new NotFoundException('Pay-in not found.');
    return payin;
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
