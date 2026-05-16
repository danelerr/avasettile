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
    expectedVolumeByAsset: AssetVolume;
    receivedVolumeByAsset: AssetVolume;
  };
  settlements: {
    count: number;
    byStatus: ReportBucket;
    fiatVolumeByCurrency: AssetVolume;
  };
};
