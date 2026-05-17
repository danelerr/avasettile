import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
    private readonly database: DatabaseService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      service: this.configuration.serviceName,
      product: 'AvaSettle',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const database = await this.database.getReadiness();
    const checks = {
      apiKeyConfigured: this.configuration.apiKeyConfigured,
      treasuryConfigured: this.configuration.treasuryConfigured,
      payInMnemonicConfigured: Boolean(this.configuration.payInMnemonic),
      assetsConfigured: this.configuration
        .getConfiguredAssets()
        .every((asset) => asset.configured),
      databaseReady: !database.required || database.reachable,
      rpcReachable: false,
    };

    try {
      const chainId = await this.blockchain.publicClient.getChainId();
      checks.rpcReachable =
        chainId === this.configuration.networkSummary.chainId;
    } catch {
      checks.rpcReachable = false;
    }

    return {
      status: Object.values(checks).every(Boolean) ? 'ready' : 'degraded',
      network: this.configuration.networkSummary,
      storage: {
        driver: database.driver,
        configured: database.configured,
        required: database.required,
        error: database.error,
      },
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
