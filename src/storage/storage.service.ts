import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEvent } from '../audit/audit.types';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import type { PayInRecord } from '../payins/payins.types';
import { PayInCollectionMode, PayInSweepStatus } from '../payins/payins.types';
import type { PayoutRecord } from '../payouts/payout.types';
import type { PrivateSettlementRecord } from '../privacy/privacy.types';
import type { SettlementRecord } from '../settlement/settlement.types';
import { StorageState } from './storage.types';

type PersistBatch = {
  payins: PayInRecord[];
  payouts: PayoutRecord[];
  newAuditEvents: AuditEvent[];
  settlements: SettlementRecord[];
  privateSettlements: PrivateSettlementRecord[];
  newIdempotencyKeys: Record<string, string>;
};

@Injectable()
export class StorageService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);
  private state: StorageState | null = null;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.configuration.storageDriver !== 'postgres') return;

    const [
      payins,
      payouts,
      auditEvents,
      settlements,
      privateSettlements,
      idempotencyKeys,
      payinAddressIndex,
    ] = await Promise.all([
      this.database.loadAllPayIns(),
      this.database.loadAllPayouts(),
      this.database.loadAllAuditEvents(),
      this.database.loadAllSettlements(),
      this.database.loadAllPrivateSettlements(),
      this.database.loadAllIdempotencyKeys(),
      this.database.loadPayInAddressIndex(),
    ]);

    this.state = this.normalizeState({
      schemaVersion: 1,
      payins,
      payouts,
      auditEvents,
      settlements,
      privateSettlements,
      counters: { payinAddressIndex },
      idempotencyKeys,
    });

    this.logger.log(
      `PostgreSQL: loaded ${payins.length} payins, ${payouts.length} payouts, ${auditEvents.length} audit events.`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.persistQueue;
  }

  get snapshot(): StorageState {
    return structuredClone(this.load());
  }

  update<T>(mutator: (state: StorageState) => T): T {
    const state = this.load();

    if (this.configuration.storageDriver === 'postgres') {
      const prevPayins        = new Set(state.payins);
      const prevPayouts       = new Set(state.payouts);
      const prevAuditLen      = state.auditEvents.length;
      const prevSettlements   = new Set(state.settlements);
      const prevPrivate       = new Set(state.privateSettlements);
      const prevIdempKeys     = { ...state.idempotencyKeys };

      const result = mutator(state);

      const batch: PersistBatch = {
        payins:              state.payins.filter((p)  => !prevPayins.has(p)),
        payouts:             state.payouts.filter((p) => !prevPayouts.has(p)),
        newAuditEvents:      state.auditEvents.slice(prevAuditLen),
        settlements:         state.settlements.filter((s) => !prevSettlements.has(s)),
        privateSettlements:  state.privateSettlements.filter((ps) => !prevPrivate.has(ps)),
        newIdempotencyKeys:  Object.fromEntries(
          Object.entries(state.idempotencyKeys).filter(([k]) => !prevIdempKeys[k]),
        ),
      };

      if (this.batchHasChanges(batch)) this.persist(batch);

      return result;
    }

    const result = mutator(state);
    this.writeFile(state);
    return result;
  }

  private load(): StorageState {
    if (this.state) return this.state;
    if (this.configuration.storageDriver === 'postgres') {
      throw new Error('PostgreSQL storage not initialized. Check lifecycle hooks.');
    }

    const filePath = this.configuration.storageFilePath;
    if (!existsSync(filePath)) {
      this.state = this.emptyState();
      this.writeFile(this.state);
      return this.state;
    }

    const raw = readFileSync(filePath, 'utf8');
    this.state = this.normalizeState(JSON.parse(raw) as Partial<StorageState>);
    return this.state;
  }

  private persist(batch: PersistBatch): void {
    const snapshot = structuredClone(batch);
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(() =>
        Promise.all([
          ...snapshot.payins.map((p)  => this.database.upsertPayIn(p)),
          ...snapshot.payouts.map((p) => this.database.upsertPayout(p)),
          ...snapshot.newAuditEvents.map((e) => this.database.insertAuditEvent(e)),
          ...snapshot.settlements.map((s) => this.database.upsertSettlement(s)),
          ...snapshot.privateSettlements.map((ps) => this.database.upsertPrivateSettlement(ps)),
          ...Object.entries(snapshot.newIdempotencyKeys).map(([k, v]) =>
            this.database.setIdempotencyKey(k, v),
          ),
        ]).then(() => undefined),
      )
      .catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : 'Failed to persist to PostgreSQL.',
        );
      });
  }

  private writeFile(state: StorageState): void {
    const filePath = this.configuration.storageFilePath;
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(tmp, filePath);
  }

  private batchHasChanges(b: PersistBatch): boolean {
    return (
      b.payins.length > 0 ||
      b.payouts.length > 0 ||
      b.newAuditEvents.length > 0 ||
      b.settlements.length > 0 ||
      b.privateSettlements.length > 0 ||
      Object.keys(b.newIdempotencyKeys).length > 0
    );
  }

  private normalizeState(parsed: Partial<StorageState>): StorageState {
    return {
      ...this.emptyState(),
      ...parsed,
      payins: (parsed.payins ?? []).map((p) => ({
        ...p,
        collectionMode:       p.collectionMode ?? PayInCollectionMode.DerivedAddress,
        routerAddress:        p.routerAddress ?? null,
        routerInvoiceId:      p.routerInvoiceId ?? null,
        sweepStatus:          p.sweepStatus ?? PayInSweepStatus.Pending,
        sweepTransactionHash: p.sweepTransactionHash ?? null,
        sweptAmount:          p.sweptAmount ?? '0',
        sweptAmountAtomic:    p.sweptAmountAtomic ?? '0',
        sweptAt:              p.sweptAt ?? null,
        sweepFailureReason:   p.sweepFailureReason ?? null,
        acceptedAt:           p.acceptedAt ?? null,
        acceptanceNote:       p.acceptanceNote ?? null,
      })),
      privateSettlements: parsed.privateSettlements ?? [],
      counters: { ...this.emptyState().counters, ...(parsed.counters ?? {}) },
      idempotencyKeys: parsed.idempotencyKeys ?? {},
    };
  }

  private emptyState(): StorageState {
    return {
      schemaVersion: 1,
      payouts: [],
      auditEvents: [],
      payins: [],
      settlements: [],
      privateSettlements: [],
      counters: { payinAddressIndex: 0 },
      idempotencyKeys: {},
    };
  }
}
