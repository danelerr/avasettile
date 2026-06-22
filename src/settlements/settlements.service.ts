import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { bytesToHex, getAddress } from 'viem';
import { AuditService } from '../audit/audit.service';
import { AuditActor } from '../audit/audit.types';
import { parseAtomicAmount } from '../blockchain/amount.utils';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementsRepository } from './settlements.repository';
import {
  PrivateSettlementRecord,
  PrivateSettlementResponse,
  PrivateSettlementStatus,
} from './settlements.types';

/**
 * Confidential settlements: record an institutional settlement on-chain as a
 * hash commitment (amount + counterparty stay private), with selective
 * disclosure to a designated auditor. Thin wrapper over the
 * PrivateSettlementRegistry; the preimage lives only in our database.
 */
@Injectable()
export class SettlementsService {
  constructor(
    private readonly audit: AuditService,
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
    private readonly repository: SettlementsRepository,
  ) {}

  async record(
    dto: CreateSettlementDto,
    context: RequestContext,
  ): Promise<PrivateSettlementResponse> {
    if (!this.configuration.privateSettlementRegistryConfigured) {
      throw new ServiceUnavailableException(
        'Confidential settlements require AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS.',
      );
    }

    const assetConfig = this.configuration.getAssetConfig(dto.asset);
    if (!assetConfig.address) {
      throw new ServiceUnavailableException(
        `Token address for ${dto.asset} is not configured.`,
      );
    }
    const amountAtomic = this.parseAmount(dto.amount, assetConfig.decimals);
    const counterparty = getAddress(dto.counterparty);

    // The random nonce blinds the commitment so the amount can't be brute-forced.
    const nonce = bytesToHex(randomBytes(32));
    const settlementRef = this.blockchain.settlementRefFromExternalId(
      dto.externalId,
    );
    const settlementId = this.blockchain.computeSettlementId(settlementRef);
    const commitment = this.blockchain.computeSettlementCommitment(
      amountAtomic,
      assetConfig.address,
      counterparty,
      nonce,
    );

    // Claim (client, externalId) before touching the chain, so concurrent
    // requests can't double-record.
    const { record, existed } = await this.repository.createOrGetExisting({
      id: randomUUID(),
      clientId: context.clientId,
      externalId: dto.externalId,
      settlementId,
      settlementRef,
      commitment,
      asset: dto.asset,
      tokenAddress: assetConfig.address,
      amount: dto.amount,
      amountAtomic: amountAtomic.toString(),
      counterparty,
      nonce,
      status: PrivateSettlementStatus.Recorded,
      transactionHash: null,
      revealTransactionHash: null,
      metadata: dto.metadata ?? {},
    });

    if (existed) return this.toResponse(record, true);

    try {
      const exec = await this.blockchain.recordPrivateSettlement({
        settlementRef,
        commitment,
      });
      const updated = await this.repository.update(record.id, {
        transactionHash: exec.hash,
      });
      await this.audit.record({
        type: 'PRIVATE_SETTLEMENT_RECORDED',
        subjectId: record.id,
        actor: this.toAuditActor(context),
        payload: {
          externalId: record.externalId,
          settlementId,
          commitment,
          transactionHash: exec.hash,
        },
      });
      return this.toResponse(updated ?? record);
    } catch (error) {
      // Release the claim so the same externalId can be retried.
      await this.repository.delete(record.id);
      throw error;
    }
  }

  async list(
    query: { limit?: number; offset?: number },
    context: RequestContext,
  ): Promise<PrivateSettlementResponse[]> {
    const records = await this.repository.list({
      clientId: context.clientId ?? undefined,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    });
    return records.map((record) => this.toResponse(record));
  }

  async get(
    id: string,
    context: RequestContext,
  ): Promise<PrivateSettlementResponse> {
    return this.toResponse(await this.requireRecord(id, context));
  }

  /** Auditor reveals the preimage on-chain, leaving an immutable attestation. */
  async reveal(
    id: string,
    context: RequestContext,
  ): Promise<PrivateSettlementResponse> {
    const record = await this.requireRecord(id, context);
    if (record.status === PrivateSettlementStatus.Revealed) {
      return this.toResponse(record, true);
    }

    const exec = await this.blockchain.revealPrivateSettlement({
      settlementId: record.settlementId,
      amountAtomic: BigInt(record.amountAtomic),
      asset: record.tokenAddress,
      counterparty: record.counterparty,
      nonce: record.nonce,
    });
    const updated = await this.repository.update(id, {
      status: PrivateSettlementStatus.Revealed,
      revealTransactionHash: exec.hash,
    });

    await this.audit.record({
      type: 'PRIVATE_SETTLEMENT_REVEALED',
      subjectId: id,
      actor: this.toAuditActor(context),
      payload: {
        settlementId: record.settlementId,
        transactionHash: exec.hash,
      },
    });

    return this.toResponse(updated ?? record);
  }

  private async requireRecord(
    id: string,
    context: RequestContext,
  ): Promise<PrivateSettlementRecord> {
    const record = await this.repository.findById(
      id,
      context.clientId ?? undefined,
    );
    if (!record) throw new NotFoundException('Settlement not found.');
    return record;
  }

  private parseAmount(amount: string, decimals: number): bigint {
    try {
      return parseAtomicAmount(amount, decimals);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid amount.',
      );
    }
  }

  // Strip the blinding nonce — it must never leave the server.
  private toResponse(
    record: PrivateSettlementRecord,
    idempotentReplay = false,
  ): PrivateSettlementResponse {
    const { nonce, ...rest } = record;
    return { ...rest, idempotentReplay: idempotentReplay || undefined };
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
