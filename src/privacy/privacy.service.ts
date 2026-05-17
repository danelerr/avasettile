import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { StorageService } from '../storage/storage.service';
import { CreatePrivateSettlementDto } from './dto/create-private-settlement.dto';
import {
  PrivateSettlementRecord,
  PrivateSettlementStatus,
} from './privacy.types';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly audit: AuditService,
    private readonly configuration: ConfigurationService,
    private readonly storage: StorageService,
  ) {}

  create(
    dto: CreatePrivateSettlementDto,
    context: RequestContext,
  ): PrivateSettlementRecord {
    if (this.configuration.privacyMode === 'off') {
      throw new BadRequestException(
        'Privacy mode is disabled. Set AVASETTLE_PRIVACY_MODE to metadata-redaction or eerc-experimental.',
      );
    }
    if (
      dto.mode === 'eerc-experimental' &&
      !this.configuration.eercContractAddress
    ) {
      throw new BadRequestException(
        'AVASETTLE_EERC_CONTRACT_ADDRESS is required for eerc-experimental mode.',
      );
    }

    const now = new Date().toISOString();
    const record: PrivateSettlementRecord = {
      id: randomUUID(),
      externalId: dto.externalId,
      mode: dto.mode,
      status: PrivateSettlementStatus.Created,
      subjectType: dto.subjectType,
      subjectId: dto.subjectId ?? null,
      asset: dto.asset,
      publicAmount:
        dto.mode === 'metadata-redaction' ? (dto.amount ?? null) : null,
      amountCommitment: this.commit({
        externalId: dto.externalId,
        amount: dto.amount ?? null,
        asset: dto.asset,
      }),
      counterpartyCommitment: dto.counterparty
        ? this.commit({ counterparty: dto.counterparty })
        : null,
      metadataHash: this.commit(dto.metadata ?? {}),
      eercContractAddress:
        dto.mode === 'eerc-experimental'
          ? this.configuration.eercContractAddress
          : null,
      createdAt: now,
      updatedAt: now,
    };

    this.storage.update((state) => {
      state.privateSettlements.push(record);
    });
    this.audit.record({
      type: 'PRIVATE_SETTLEMENT_CREATED',
      subjectId: record.id,
      actor: {
        institutionId: context.institutionId,
        actor: context.actor,
        correlationId: context.correlationId,
        sourceIp: context.sourceIp,
      },
      payload: {
        externalId: record.externalId,
        mode: record.mode,
        subjectType: record.subjectType,
        subjectId: record.subjectId,
        asset: record.asset,
      },
    });

    return record;
  }

  list(): PrivateSettlementRecord[] {
    return this.storage.snapshot.privateSettlements.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  get(id: string): PrivateSettlementRecord {
    const record = this.storage.snapshot.privateSettlements.find(
      (settlement) => settlement.id === id,
    );
    if (!record) throw new NotFoundException('Private settlement not found.');
    return record;
  }

  private commit(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
