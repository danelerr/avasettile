import { Injectable } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { ConfigurationService } from '../configuration/configuration.service';
import { StorageState } from './storage.types';

@Injectable()
export class StorageService {
  private state: StorageState | null = null;

  constructor(private readonly configuration: ConfigurationService) {}

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

    const filePath = this.configuration.storageFilePath;
    if (!existsSync(filePath)) {
      this.state = this.emptyState();
      this.save(this.state);
      return this.state;
    }

    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StorageState>;
    this.state = {
      ...this.emptyState(),
      ...parsed,
      counters: {
        ...this.emptyState().counters,
        ...(parsed.counters ?? {}),
      },
    };
    return this.state;
  }

  private save(state: StorageState): void {
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
      counters: {
        payinAddressIndex: 0,
      },
    };
  }
}
