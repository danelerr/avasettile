import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PayInCollectionMode, PayInRecord, PayInStatus } from './payins.types';

@Injectable()
export class PayInLedgerService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Atomically checks for an existing record with externalId, allocates a
   * derivation index, and creates the record — all in one storage.update().
   *
   * When preClaimedIndex is provided (claimed from the SQL counter for
   * multi-instance Postgres deployments), it is used instead of the in-memory
   * counter. The in-memory counter is kept in sync.
   */
  findOrCreate(
    externalId: string,
    collectionMode: PayInCollectionMode,
    factory: (derivationIndex: number) => PayInRecord,
    preClaimedIndex?: number,
  ): { record: PayInRecord; existed: boolean } {
    return this.storage.update((state) => {
      const existing = state.payins.find((p) => p.externalId === externalId);
      if (existing) return { record: existing, existed: true };

      let derivationIndex: number;
      if (collectionMode === PayInCollectionMode.PaymentRouter) {
        derivationIndex = -1;
      } else if (preClaimedIndex !== undefined) {
        derivationIndex = preClaimedIndex;
        if (preClaimedIndex >= state.counters.payinAddressIndex) {
          state.counters.payinAddressIndex = preClaimedIndex + 1;
        }
      } else {
        derivationIndex = state.counters.payinAddressIndex++;
      }

      const record = factory(derivationIndex);
      state.payins.push(record);
      return { record, existed: false };
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

  list(filters: {
    status?: PayInStatus;
    externalId?: string;
    limit?: number;
    offset?: number;
  }): PayInRecord[] {
    const sorted = this.storage.snapshot.payins
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

  findByIdempotencyKey(key: string): PayInRecord | null {
    const id = this.storage.snapshot.idempotencyKeys[key];
    if (!id) return null;
    return this.findById(id);
  }

  storeIdempotencyKey(key: string, recordId: string): void {
    this.storage.update((state) => {
      state.idempotencyKeys[key] = recordId;
    });
  }
}
