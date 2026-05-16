import type { AuditEvent } from '../audit/audit.types';
import type { PayInRecord } from '../payins/payins.types';
import type { PayoutRecord } from '../payouts/payout.types';
import type { SettlementRecord } from '../settlement/settlement.types';

export type StorageCounters = {
  payinAddressIndex: number;
};

export type StorageState = {
  schemaVersion: 1;
  payouts: PayoutRecord[];
  auditEvents: AuditEvent[];
  payins: PayInRecord[];
  settlements: SettlementRecord[];
  counters: StorageCounters;
};
