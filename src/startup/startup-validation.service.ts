import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class StartupValidationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupValidationService.name);

  constructor(private readonly configuration: ConfigurationService) {}

  onApplicationBootstrap(): void {
    const warnings: string[] = [];

    if (!this.configuration.apiKeyConfigured) {
      warnings.push(
        'AVASETTLE_API_KEY is not set — all API endpoints are unprotected.',
      );
    }

    if (!this.configuration.treasuryConfigured) {
      warnings.push(
        'AVASETTLE_TREASURY_PRIVATE_KEY is not set — payouts and sweeps are disabled.',
      );
    }

    if (!this.configuration.payInMnemonic) {
      warnings.push(
        'AVASETTLE_PAYIN_MNEMONIC is not set — derived-address pay-ins are disabled.',
      );
    }

    const unconfiguredAssets = this.configuration
      .getConfiguredAssets()
      .filter((a) => !a.configured);
    if (unconfiguredAssets.length > 0) {
      warnings.push(
        `Token address not configured for: ${unconfiguredAssets.map((a) => `AVASETTLE_${a.symbol}_ADDRESS`).join(', ')}.`,
      );
    }

    if (
      this.configuration.storageDriver === 'postgres' &&
      !this.configuration.databaseConfigured
    ) {
      warnings.push(
        'AVASETTLE_STORAGE_DRIVER=postgres but no DATABASE_URL or AVASETTLE_DATABASE_URL is set.',
      );
    }

    for (const warning of warnings) {
      this.logger.warn(warning);
    }

    this.logger.log(
      `AvaSettle started — network: ${this.configuration.settlementNetwork}, storage: ${this.configuration.storageDriver}.`,
    );
  }
}
