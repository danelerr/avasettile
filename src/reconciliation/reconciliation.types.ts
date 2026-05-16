export type ReconciliationItemResult = {
  type: 'payout' | 'payin';
  id: string;
  status: string;
  ok: boolean;
  error?: string;
};

export type ReconciliationRunResult = {
  startedAt: string;
  completedAt: string;
  payoutsChecked: number;
  payinsChecked: number;
  results: ReconciliationItemResult[];
};
