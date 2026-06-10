import { Injectable } from '@nestjs/common';
import { PayinsService } from '../payins/payins.service';
import { PayInStatus } from '../payins/payins.types';
import { PayoutsService } from '../payouts/payouts.service';
import { PayoutStatus, RequestContext } from '../payouts/payout.types';
import { ReconciliationRunResult } from './reconciliation.types';

const RECONCILIATION_CONCURRENCY = 10;

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly payins: PayinsService,
    private readonly payouts: PayoutsService,
  ) {}

  async run(context: RequestContext): Promise<ReconciliationRunResult> {
    const startedAt = new Date().toISOString();
    const now = Date.now();

    const payoutCandidates = this.payouts.listPayouts({
      status: PayoutStatus.Broadcasted,
    });

    // Pending payins that have already expired are excluded — no blockchain
    // scan needed since reconcilePayIn would immediately mark them Expired
    // without any transfer activity. Detected/Underpaid still need scanning
    // because funds have already arrived and may still confirm.
    const pendingCandidates = this.payins
      .listPayIns({ status: PayInStatus.Pending })
      .filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() > now);

    const payinCandidates = [
      ...pendingCandidates,
      ...this.payins.listPayIns({ status: PayInStatus.Detected }),
      ...this.payins.listPayIns({ status: PayInStatus.Underpaid }),
    ];

    const results: ReconciliationRunResult['results'] = [];

    for (
      let i = 0;
      i < payoutCandidates.length;
      i += RECONCILIATION_CONCURRENCY
    ) {
      const batch = payoutCandidates.slice(i, i + RECONCILIATION_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((payout) =>
          this.payouts
            .reconcilePayout(payout.id, context)
            .then((reconciled) => ({
              type: 'payout' as const,
              id: payout.id,
              status: reconciled.status,
              ok: true,
            }))
            .catch((error) => ({
              type: 'payout' as const,
              id: payout.id,
              status: payout.status,
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            })),
        ),
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') results.push(s.value);
      }
    }

    for (
      let i = 0;
      i < payinCandidates.length;
      i += RECONCILIATION_CONCURRENCY
    ) {
      const batch = payinCandidates.slice(i, i + RECONCILIATION_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((payin) =>
          this.payins
            .reconcilePayIn(payin.id, context)
            .then((reconciled) => ({
              type: 'payin' as const,
              id: payin.id,
              status: reconciled.status,
              ok: true,
            }))
            .catch((error) => ({
              type: 'payin' as const,
              id: payin.id,
              status: payin.status,
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            })),
        ),
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') results.push(s.value);
      }
    }

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      payoutsChecked: payoutCandidates.length,
      payinsChecked: payinCandidates.length,
      results,
    };
  }
}
