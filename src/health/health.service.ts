import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
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
    const checks = {
      apiKeyConfigured: this.configuration.apiKeyConfigured,
      treasuryConfigured: this.configuration.treasuryConfigured,
      assetsConfigured: this.configuration
        .getConfiguredAssets()
        .every((asset) => asset.configured),
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
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
