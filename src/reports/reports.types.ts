export type ReportBucket = Record<string, number>;

export type AssetVolume = Record<string, string>;

export type InstitutionalSummaryReport = {
  generatedAt: string;
  payouts: {
    count: number;
    byStatus: ReportBucket;
    volumeByAsset: AssetVolume;
  };
  payins: {
    count: number;
    byStatus: ReportBucket;
    byCollectionMode: ReportBucket;
    bySweepStatus: ReportBucket;
    expectedVolumeByAsset: AssetVolume;
    receivedVolumeByAsset: AssetVolume;
    sweptVolumeByAsset: AssetVolume;
  };
  settlements: {
    count: number;
    byStatus: ReportBucket;
    fiatVolumeByCurrency: AssetVolume;
  };
  privateSettlements: {
    count: number;
    byStatus: ReportBucket;
    byMode: ReportBucket;
  };
};
