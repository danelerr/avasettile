import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PayoutRecord, PayoutStatus } from './payout.types';

@Injectable()
export class PayoutLedgerService {
  constructor(private readonly storage: StorageService) {}

  create(record: PayoutRecord): PayoutRecord {
    this.storage.update((state) => {
      state.payouts.push(record);
    });
    return record;
  }

  findById(id: string): PayoutRecord | null {
    return (
      this.storage.snapshot.payouts.find((record) => record.id === id) ?? null
    );
  }

  findByExternalId(externalId: string): PayoutRecord | null {
    return (
      this.storage.snapshot.payouts.find(
        (record) => record.externalId === externalId,
      ) ?? null
    );
  }

  list(filters: {
    status?: PayoutStatus;
    externalId?: string;
    limit?: number;
    offset?: number;
  }): PayoutRecord[] {
    const sorted = this.storage.snapshot.payouts
      .filter((record) => !filters.status || record.status === filters.status)
      .filter(
        (record) =>
          !filters.externalId || record.externalId === filters.externalId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.limit === undefined) return sorted;
    const offset = filters.offset ?? 0;
    return sorted.slice(offset, offset + filters.limit);
  }

  update(id: string, patch: Partial<PayoutRecord>): PayoutRecord | null {
    return this.storage.update((state) => {
      const index = state.payouts.findIndex((record) => record.id === id);
      if (index === -1) return null;

      const next = {
        ...state.payouts[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      state.payouts[index] = next;
      return next;
    });
  }
}
