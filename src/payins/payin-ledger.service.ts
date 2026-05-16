import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PayInRecord, PayInStatus } from './payins.types';

@Injectable()
export class PayInLedgerService {
  constructor(private readonly storage: StorageService) {}

  create(record: PayInRecord): PayInRecord {
    this.storage.update((state) => {
      state.payins.push(record);
    });
    return record;
  }

  nextDerivationIndex(): number {
    return this.storage.update((state) => {
      const index = state.counters.payinAddressIndex;
      state.counters.payinAddressIndex += 1;
      return index;
    });
  }

  findById(id: string): PayInRecord | null {
    return (
      this.storage.snapshot.payins.find((record) => record.id === id) ?? null
    );
  }

  findByExternalId(externalId: string): PayInRecord | null {
    return (
      this.storage.snapshot.payins.find(
        (record) => record.externalId === externalId,
      ) ?? null
    );
  }

  list(filters: { status?: PayInStatus; externalId?: string }): PayInRecord[] {
    return this.storage.snapshot.payins
      .filter((record) => !filters.status || record.status === filters.status)
      .filter(
        (record) =>
          !filters.externalId || record.externalId === filters.externalId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  update(id: string, patch: Partial<PayInRecord>): PayInRecord | null {
    return this.storage.update((state) => {
      const index = state.payins.findIndex((record) => record.id === id);
      if (index === -1) return null;

      const next = {
        ...state.payins[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      state.payins[index] = next;
      return next;
    });
  }
}
