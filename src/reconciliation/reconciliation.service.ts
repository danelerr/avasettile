import { Injectable } from '@nestjs/common';
import { PayinsService } from '../payins/payins.service';
import { PayInStatus } from '../payins/payins.types';
import { PayoutsService } from '../payouts/payouts.service';
import { PayoutStatus, RequestContext } from '../payouts/payout.types';
import { ReconciliationRunResult } from './reconciliation.types';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly payins: PayinsService,
    private readonly payouts: PayoutsService,
  ) {}

  async run(context: RequestContext): Promise<ReconciliationRunResult> {
    const startedAt = new Date().toISOString();
    const payoutCandidates = this.payouts.listPayouts({
      status: PayoutStatus.Broadcasted,
    });
    const payinCandidates = [
      ...this.payins.listPayIns({ status: PayInStatus.Pending }),
      ...this.payins.listPayIns({ status: PayInStatus.Detected }),
      ...this.payins.listPayIns({ status: PayInStatus.Underpaid }),
    ];
    const results: ReconciliationRunResult['results'] = [];

    for (const payout of payoutCandidates) {
      try {
        const reconciled = await this.payouts.reconcilePayout(
          payout.id,
          context,
        );
        results.push({
          type: 'payout',
          id: payout.id,
          status: reconciled.status,
          ok: true,
        });
      } catch (error) {
        results.push({
          type: 'payout',
          id: payout.id,
          status: payout.status,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    for (const payin of payinCandidates) {
      try {
        const reconciled = await this.payins.reconcilePayIn(payin.id, context);
        results.push({
          type: 'payin',
          id: payin.id,
          status: reconciled.status,
          ok: true,
        });
      } catch (error) {
        results.push({
          type: 'payin',
          id: payin.id,
          status: payin.status,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
