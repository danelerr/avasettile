import { Injectable } from '@nestjs/common';
import { PayoutRecord, PayoutStatus } from './payout.types';

@Injectable()
export class PayoutLedgerService {
  private readonly records = new Map<string, PayoutRecord>();
  private readonly idsByExternalId = new Map<string, string>();

  create(record: PayoutRecord): PayoutRecord {
    this.records.set(record.id, record);
    this.idsByExternalId.set(record.externalId, record.id);
    return record;
  }

  findById(id: string): PayoutRecord | null {
    return this.records.get(id) ?? null;
  }

  findByExternalId(externalId: string): PayoutRecord | null {
    const id = this.idsByExternalId.get(externalId);
    return id ? this.findById(id) : null;
  }

  list(filters: {
    status?: PayoutStatus;
    externalId?: string;
  }): PayoutRecord[] {
    const records = Array.from(this.records.values());
    return records
      .filter((record) => !filters.status || record.status === filters.status)
      .filter(
        (record) =>
          !filters.externalId || record.externalId === filters.externalId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  update(id: string, patch: Partial<PayoutRecord>): PayoutRecord | null {
    const current = this.findById(id);
    if (!current) return null;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, next);
    return next;
  }
}
