import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { StorageService } from '../storage/storage.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { SettlementRecord, SettlementStatus } from './settlement.types';

@Injectable()
export class SettlementService {
  constructor(
    private readonly audit: AuditService,
    private readonly configuration: ConfigurationService,
    private readonly storage: StorageService,
  ) {}

  create(dto: CreateSettlementDto, context: RequestContext): SettlementRecord {
    const fxRate = this.configuration.fiatSettlementRate;
    const fiatAmount = Number(dto.cryptoAmount) * fxRate;
    const now = new Date().toISOString();
    const record: SettlementRecord = {
      id: randomUUID(),
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      status: SettlementStatus.Pending,
      asset: dto.asset,
      cryptoAmount: dto.cryptoAmount,
      fiatCurrency:
        dto.fiatCurrency?.toUpperCase() ??
        this.configuration.fiatSettlementCurrency,
      fiatAmount: fiatAmount.toFixed(2),
      fxRate: fxRate.toString(),
      rail: dto.rail ?? 'simulated-fiat-rail',
      reference: dto.reference ?? null,
      metadata: dto.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failureReason: null,
    };

    this.storage.update((state) => {
      state.settlements.push(record);
    });
    this.audit.record({
      type: 'SETTLEMENT_CREATED',
      subjectId: record.id,
      actor: {
        institutionId: context.institutionId,
        actor: context.actor,
        correlationId: context.correlationId,
        sourceIp: context.sourceIp,
      },
      payload: record,
    });

    return record;
  }

  list(query: ListSettlementsQueryDto): SettlementRecord[] {
    return this.storage.snapshot.settlements
      .filter((record) => !query.status || record.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): SettlementRecord {
    const record = this.storage.snapshot.settlements.find(
      (settlement) => settlement.id === id,
    );
    if (!record) throw new NotFoundException('Settlement not found.');
    return record;
  }

  complete(id: string, context: RequestContext): SettlementRecord {
    const now = new Date().toISOString();
    const updated = this.storage.update((state) => {
      const index = state.settlements.findIndex((record) => record.id === id);
      if (index === -1) return null;
      const next = {
        ...state.settlements[index],
        status: SettlementStatus.Completed,
        updatedAt: now,
        completedAt: now,
        failureReason: null,
      };
      state.settlements[index] = next;
      return next;
    });
    if (!updated) throw new NotFoundException('Settlement not found.');

    this.audit.record({
      type: 'SETTLEMENT_COMPLETED',
      subjectId: id,
      actor: {
        institutionId: context.institutionId,
        actor: context.actor,
        correlationId: context.correlationId,
        sourceIp: context.sourceIp,
      },
      payload: updated,
    });

    return updated;
  }
}
