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
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { PayInCollectionMode, PayInSweepStatus } from '../payins/payins.types';
import { StorageState } from './storage.types';

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

    await this.database.ensureRuntimeStateTable();

    const key = this.configuration.databaseRuntimeStateKey;
    const persisted = await this.database.loadRuntimeState(key);
    this.state = this.normalizeState(persisted ?? this.emptyState());

    if (!persisted) {
      await this.database.saveRuntimeState(key, this.state);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.persistQueue;
  }

  get snapshot(): StorageState {
    return structuredClone(this.load());
  }

  update<T>(mutator: (state: StorageState) => T): T {
    const state = this.load();
    const result = mutator(state);
    this.save(state);
    return result;
  }

  private load(): StorageState {
    if (this.state) return this.state;
    if (this.configuration.storageDriver === 'postgres') {
      throw new Error(
        'PostgreSQL storage has not been initialized. Ensure Nest lifecycle hooks are running.',
      );
    }

    const filePath = this.configuration.storageFilePath;
    if (!existsSync(filePath)) {
      this.state = this.emptyState();
      this.save(this.state);
      return this.state;
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StorageState>;
    this.state = this.normalizeState(parsed);
    return this.state;
  }

  private normalizeState(parsed: Partial<StorageState>): StorageState {
    return {
      ...this.emptyState(),
      ...parsed,
      payins: (parsed.payins ?? []).map((payin) => ({
        ...payin,
        collectionMode:
          payin.collectionMode ?? PayInCollectionMode.DerivedAddress,
        routerAddress: payin.routerAddress ?? null,
        routerInvoiceId: payin.routerInvoiceId ?? null,
        sweepStatus: payin.sweepStatus ?? PayInSweepStatus.Pending,
        sweepTransactionHash: payin.sweepTransactionHash ?? null,
        sweptAmount: payin.sweptAmount ?? '0',
        sweptAmountAtomic: payin.sweptAmountAtomic ?? '0',
        sweptAt: payin.sweptAt ?? null,
        sweepFailureReason: payin.sweepFailureReason ?? null,
      })),
      privateSettlements: parsed.privateSettlements ?? [],
      counters: {
        ...this.emptyState().counters,
        ...(parsed.counters ?? {}),
      },
    };
  }

  private save(state: StorageState): void {
    if (this.configuration.storageDriver === 'postgres') {
      const key = this.configuration.databaseRuntimeStateKey;
      const snapshot = structuredClone(state);
      this.persistQueue = this.persistQueue
        .catch(() => undefined)
        .then(() => this.database.saveRuntimeState(key, snapshot))
        .catch((error: unknown) => {
          this.logger.error(
            error instanceof Error
              ? error.message
              : 'Failed to persist ledger state to PostgreSQL.',
          );
        });
      return;
    }

    const filePath = this.configuration.storageFilePath;
    mkdirSync(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(tmpPath, filePath);
  }

  private emptyState(): StorageState {
    return {
      schemaVersion: 1,
      payouts: [],
      auditEvents: [],
      payins: [],
      settlements: [],
      privateSettlements: [],
      counters: {
        payinAddressIndex: 0,
      },
    };
  }
}
