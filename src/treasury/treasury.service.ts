import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly configuration: ConfigurationService,
  ) {}

  getStatus() {
    return {
      service: this.configuration.serviceName,
      network: this.configuration.networkSummary,
      treasury: {
        configured: this.configuration.treasuryConfigured,
        address: this.blockchain.treasuryAddress,
      },
      payins: {
        mnemonicConfigured: Boolean(this.configuration.payInMnemonic),
        derivationAccount: this.configuration.payInDerivationAccount,
        lookbackBlocks: this.configuration.payInLookbackBlocks.toString(),
        paymentRouterConfigured: this.configuration.paymentRouterConfigured,
        paymentRouterAddress: this.configuration.paymentRouterAddress,
      },
      settlement: {
        enabledAssets: this.configuration.getConfiguredAssets(),
        minConfirmations: this.configuration.minConfirmations,
        waitForReceipt: this.configuration.waitForReceipt,
      },
      privacy: {
        mode: this.configuration.privacyMode,
        eercContractAddress: this.configuration.eercContractAddress,
      },
    };
  }

  async getBalances() {
    const assets = await Promise.all(
      this.configuration.enabledAssets.map(async (asset) => {
        try {
          return {
            configured: true,
            ...(await this.blockchain.getAssetBalance(asset)),
          };
        } catch (error) {
          return {
            asset,
            configured: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to read asset balance.',
          };
        }
      }),
    );

    return {
      network: this.configuration.networkSummary,
      treasuryAddress: this.blockchain.treasuryAddress,
      native: await this.blockchain.getNativeBalance().catch((error) => ({
        asset: 'AVAX' as const,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to read native balance.',
      })),
      assets,
    };
  }
}
