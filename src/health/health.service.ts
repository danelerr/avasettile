import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ClientsRepository } from '../clients/clients.repository';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly clients: ClientsRepository,
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
      adminApiKeyConfigured: this.configuration.adminApiKeyConfigured,
      treasuryConfigured: this.configuration.treasuryConfigured,
      payInMnemonicConfigured: Boolean(this.configuration.payInMnemonic),
      assetsConfigured: this.configuration
        .getConfiguredAssets()
        .every((asset) => asset.configured),
      databaseReady: database.reachable,
      rpcReachable: false,
    };

    let registeredClients: number | null = null;
    if (database.reachable) {
      try {
        registeredClients = await this.clients.count();
      } catch {
        registeredClients = null;
      }
    }

    try {
      const chainId = await this.blockchain.getChainId();
      checks.rpcReachable =
        chainId === this.configuration.networkSummary.chainId;
    } catch {
      checks.rpcReachable = false;
    }

    return {
      status: Object.values(checks).every(Boolean) ? 'ready' : 'degraded',
      network: this.configuration.networkSummary,
      database: {
        configured: database.configured,
        reachable: database.reachable,
        error: database.error,
      },
      registeredClients,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
