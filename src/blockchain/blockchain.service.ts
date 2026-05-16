import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Address,
  Chain,
  Hash,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalanche, avalancheFuji } from 'viem/chains';
import { ConfigurationService } from '../configuration/configuration.service';
import { SettlementAsset } from '../configuration/configuration.types';
import {
  NativeTreasuryBalance,
  TransactionReconciliation,
  TransferExecution,
  TreasuryBalance,
} from './blockchain.types';

@Injectable()
export class BlockchainService {
  constructor(private readonly configuration: ConfigurationService) {}

  get chain(): Chain {
    return this.configuration.settlementNetwork === 'avalanche-mainnet'
      ? avalanche
      : avalancheFuji;
  }

  get treasuryAddress(): Address | null {
    const privateKey = this.configuration.treasuryPrivateKey;
    if (!privateKey) return null;
    return privateKeyToAccount(privateKey).address;
  }

  get publicClient() {
    return createPublicClient({
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });
  }

  toAtomicAmount(asset: SettlementAsset, amount: string): bigint {
    const assetConfig = this.requireAsset(asset);

    try {
      const amountAtomic = parseUnits(amount, assetConfig.decimals);
      if (amountAtomic <= 0n) {
        throw new BadRequestException(
          'Payout amount must be greater than zero.',
        );
      }

      if (assetConfig.maxPayoutAmount) {
        const maxAtomic = parseUnits(
          assetConfig.maxPayoutAmount,
          assetConfig.decimals,
        );
        if (amountAtomic > maxAtomic) {
          throw new BadRequestException(
            `Payout exceeds configured max for ${asset}.`,
          );
        }
      }

      return amountAtomic;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Invalid ${asset} amount.`);
    }
  }

  async getNativeBalance(): Promise<NativeTreasuryBalance> {
    const treasuryAddress = this.requireTreasuryAddress();
    const balance = await this.publicClient.getBalance({
      address: treasuryAddress,
    });

    return {
      asset: 'AVAX',
      balanceAtomic: balance.toString(),
      balance: formatEther(balance),
    };
  }

  async getAssetBalance(asset: SettlementAsset): Promise<TreasuryBalance> {
    const treasuryAddress = this.requireTreasuryAddress();
    const assetConfig = this.requireAsset(asset);
    const balance = await this.publicClient.readContract({
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    });

    return {
      asset,
      tokenAddress: assetConfig.address,
      decimals: assetConfig.decimals,
      balanceAtomic: balance.toString(),
      balance: formatUnits(balance, assetConfig.decimals),
    };
  }

  async sendErc20Transfer(input: {
    asset: SettlementAsset;
    to: Address;
    amountAtomic: bigint;
  }): Promise<TransferExecution> {
    if (!isAddress(input.to)) {
      throw new BadRequestException(
        'Beneficiary address is not a valid EVM address.',
      );
    }

    const privateKey = this.configuration.treasuryPrivateKey;
    if (!privateKey) {
      throw new ServiceUnavailableException(
        'AvaSettle treasury private key is not configured.',
      );
    }

    const account = privateKeyToAccount(privateKey);
    const assetConfig = this.requireAsset(input.asset);
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });

    await this.publicClient.simulateContract({
      account,
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [input.to, input.amountAtomic],
    });

    const hash = await walletClient.writeContract({
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [input.to, input.amountAtomic],
    });

    if (!this.configuration.waitForReceipt) {
      return {
        hash,
        status: 'broadcasted',
      };
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return {
      hash,
      status: receipt.status === 'success' ? 'confirmed' : 'broadcasted',
      blockNumber: receipt.blockNumber.toString(),
    };
  }

  async reconcileTransaction(hash: Hash): Promise<TransactionReconciliation> {
    const receipt = await this.publicClient
      .getTransactionReceipt({ hash })
      .catch(() => null);
    if (!receipt) {
      return {
        hash,
        network: this.configuration.settlementNetwork,
        status: 'pending',
        blockNumber: null,
        confirmations: 0,
        finalized: false,
      };
    }

    const latestBlock = await this.publicClient.getBlockNumber();
    const confirmations =
      latestBlock >= receipt.blockNumber
        ? Number(latestBlock - receipt.blockNumber + 1n)
        : 0;

    return {
      hash,
      network: this.configuration.settlementNetwork,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: receipt.blockNumber.toString(),
      confirmations,
      finalized:
        receipt.status === 'success' &&
        confirmations >= this.configuration.minConfirmations,
    };
  }

  private requireTreasuryAddress(): Address {
    const treasuryAddress = this.treasuryAddress;
    if (!treasuryAddress) {
      throw new ServiceUnavailableException(
        'AvaSettle treasury private key is not configured.',
      );
    }

    return treasuryAddress;
  }

  private requireAsset(asset: SettlementAsset) {
    const assetConfig = this.configuration.getAssetConfig(asset);
    if (!assetConfig.address) {
      throw new ServiceUnavailableException(
        `Token address for ${asset} is not configured.`,
      );
    }

    return {
      ...assetConfig,
      address: assetConfig.address,
    };
  }
}
