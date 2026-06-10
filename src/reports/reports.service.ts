import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { PayInStatus, PayInSweepStatus } from '../payins/payins.types';
import { WebhookService } from '../webhooks/webhook.service';
import {
  AssetVolume,
  AuditTrailReport,
  InstitutionalSummaryReport,
  ReportBucket,
  SweepQueueItem,
  SweepQueueReport,
  WebhookDeliveriesReport,
} from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly audit: AuditService,
    private readonly database: DatabaseService,
    private readonly webhooks: WebhookService,
  ) {}

  async getInstitutionalSummary(
    clientId: string,
  ): Promise<InstitutionalSummaryReport> {
    const [payoutRows, payinRows] = await Promise.all([
      this.database.query<{
        status: string;
        asset: string;
        count: string;
        volume: string | null;
      }>(
        `SELECT status, asset, count(*) AS count, sum(amount::numeric) AS volume
         FROM avasettle_payouts
         WHERE client_id = $1
         GROUP BY status, asset`,
        [clientId],
      ),
      this.database.query<{
        status: string;
        collection_mode: string;
        sweep_status: string;
        asset: string;
        count: string;
        expected_volume: string | null;
        received_volume: string | null;
        swept_volume: string | null;
      }>(
        `SELECT status, collection_mode, sweep_status, asset, count(*) AS count,
                sum(expected_amount::numeric) AS expected_volume,
                sum(received_amount::numeric) AS received_volume,
                sum(swept_amount::numeric)    AS swept_volume
         FROM avasettle_payins
         WHERE client_id = $1
         GROUP BY status, collection_mode, sweep_status, asset`,
        [clientId],
      ),
    ]);

    const payoutsByStatus: ReportBucket = {};
    const payoutVolumeByAsset: Record<string, number> = {};
    let payoutCount = 0;
    for (const row of payoutRows.rows) {
      const count = parseInt(row.count, 10);
      payoutCount += count;
      payoutsByStatus[row.status] = (payoutsByStatus[row.status] ?? 0) + count;
      payoutVolumeByAsset[row.asset] =
        (payoutVolumeByAsset[row.asset] ?? 0) + Number(row.volume ?? 0);
    }

    const payinsByStatus: ReportBucket = {};
    const payinsByCollectionMode: ReportBucket = {};
    const payinsBySweepStatus: ReportBucket = {};
    const expectedByAsset: Record<string, number> = {};
    const receivedByAsset: Record<string, number> = {};
    const sweptByAsset: Record<string, number> = {};
    let payinCount = 0;
    for (const row of payinRows.rows) {
      const count = parseInt(row.count, 10);
      payinCount += count;
      payinsByStatus[row.status] = (payinsByStatus[row.status] ?? 0) + count;
      payinsByCollectionMode[row.collection_mode] =
        (payinsByCollectionMode[row.collection_mode] ?? 0) + count;
      payinsBySweepStatus[row.sweep_status] =
        (payinsBySweepStatus[row.sweep_status] ?? 0) + count;
      expectedByAsset[row.asset] =
        (expectedByAsset[row.asset] ?? 0) + Number(row.expected_volume ?? 0);
      receivedByAsset[row.asset] =
        (receivedByAsset[row.asset] ?? 0) + Number(row.received_volume ?? 0);
      sweptByAsset[row.asset] =
        (sweptByAsset[row.asset] ?? 0) + Number(row.swept_volume ?? 0);
    }

    return {
      generatedAt: new Date().toISOString(),
      payouts: {
        count: payoutCount,
        byStatus: payoutsByStatus,
        volumeByAsset: toFixedVolumes(payoutVolumeByAsset),
      },
      payins: {
        count: payinCount,
        byStatus: payinsByStatus,
        byCollectionMode: payinsByCollectionMode,
        bySweepStatus: payinsBySweepStatus,
        expectedVolumeByAsset: toFixedVolumes(expectedByAsset),
        receivedVolumeByAsset: toFixedVolumes(receivedByAsset),
        sweptVolumeByAsset: toFixedVolumes(sweptByAsset),
      },
    };
  }

  /**
   * Operational view across all clients: confirmed pay-ins whose funds are
   * still sitting on deposit addresses. Admin-only.
   */
  async getSweepQueue(): Promise<SweepQueueReport> {
    const result = await this.database.query<{
      id: string;
      client_id: string | null;
      external_id: string;
      deposit_address: string;
      asset: string;
      received_amount: string;
      received_amount_atomic: string;
      sweep_status: string;
      sweep_failure_reason: string | null;
      confirmed_at: Date | null;
    }>(
      `SELECT id, client_id, external_id, deposit_address, asset,
              received_amount, received_amount_atomic,
              sweep_status, sweep_failure_reason, confirmed_at
       FROM avasettle_payins
       WHERE status = $1 AND sweep_status IN ($2, $3)
       ORDER BY confirmed_at ASC NULLS LAST`,
      [
        PayInStatus.Confirmed,
        PayInSweepStatus.Pending,
        PayInSweepStatus.Failed,
      ],
    );

    const items: SweepQueueItem[] = result.rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      externalId: row.external_id,
      depositAddress: row.deposit_address,
      asset: row.asset,
      receivedAmount: row.received_amount,
      receivedAmountAtomic: row.received_amount_atomic,
      sweepStatus: row.sweep_status,
      sweepFailureReason: row.sweep_failure_reason,
      confirmedAt: row.confirmed_at
        ? new Date(row.confirmed_at).toISOString()
        : null,
    }));

    return {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  }

  async getWebhookDeliveries(
    clientId: string,
    limit: number,
    onlyFailed?: boolean,
  ): Promise<WebhookDeliveriesReport> {
    const items = await this.webhooks.listRecentDeliveries(
      clientId,
      Math.min(limit, 500),
      onlyFailed,
    );
    return {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  }

  async getAuditTrail(
    clientId: string,
    from?: string,
    to?: string,
    subjectId?: string,
    limit = 200,
  ): Promise<AuditTrailReport> {
    const events = await this.audit.listForTrail({
      clientId,
      subjectId,
      from,
      to,
      limit,
    });

    return {
      generatedAt: new Date().toISOString(),
      count: events.length,
      events,
    };
  }
}

function toFixedVolumes(volumes: Record<string, number>): AssetVolume {
  return Object.fromEntries(
    Object.entries(volumes).map(([asset, volume]) => [
      asset,
      volume.toFixed(2),
    ]),
  );
}
