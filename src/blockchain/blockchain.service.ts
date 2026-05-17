import {
  BadRequestException,
  ConflictException,
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
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  parseUnits,
  stringToBytes,
  keccak256,
} from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { avalanche, avalancheFuji } from 'viem/chains';
import { ConfigurationService } from '../configuration/configuration.service';
import { SettlementAsset } from '../configuration/configuration.types';
import {
  NativeTreasuryBalance,
  IncomingErc20Transfer,
  PaymentRouterInvoicePayment,
  SweepExecution,
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

  getLatestBlockNumber(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  derivePayInAddress(index: number): Address {
    return this.derivePayInAccount(index).address;
  }

  routerInvoiceIdFromExternalId(externalId: string): `0x${string}` {
    return keccak256(stringToBytes(externalId));
  }

  derivePayInAccount(index: number) {
    const mnemonic = this.configuration.payInMnemonic;
    if (!mnemonic) {
      throw new ServiceUnavailableException(
        'AvaSettle pay-in mnemonic is not configured.',
      );
    }

    return mnemonicToAccount(mnemonic, {
      accountIndex: this.configuration.payInDerivationAccount,
      addressIndex: index,
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

  async getNativeBalanceForAddress(
    address: Address,
  ): Promise<NativeTreasuryBalance> {
    const balance = await this.publicClient.getBalance({ address });

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

  async getAssetBalanceForAddress(input: {
    asset: SettlementAsset;
    address: Address;
  }): Promise<TreasuryBalance> {
    const assetConfig = this.requireAsset(input.asset);
    const balance = await this.publicClient.readContract({
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [input.address],
    });

    return {
      asset: input.asset,
      tokenAddress: assetConfig.address,
      decimals: assetConfig.decimals,
      balanceAtomic: balance.toString(),
      balance: formatUnits(balance, assetConfig.decimals),
    };
  }

  async findIncomingErc20Transfers(input: {
    asset: SettlementAsset;
    to: Address;
    fromBlock: bigint;
  }): Promise<IncomingErc20Transfer[]> {
    const assetConfig = this.requireAsset(input.asset);
    const latestBlock = await this.publicClient.getBlockNumber();
    const configuredFromBlock =
      input.fromBlock > 0n
        ? input.fromBlock
        : latestBlock - this.configuration.payInLookbackBlocks;
    const fromBlock = configuredFromBlock > 0n ? configuredFromBlock : 0n;
    const transferEvent = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    );
    const logs = await this.publicClient.getLogs({
      address: assetConfig.address,
      event: transferEvent,
      args: {
        to: input.to,
      },
      fromBlock,
      toBlock: 'latest',
    });

    return logs.map((log) => ({
      hash: log.transactionHash,
      from: log.args.from as `0x${string}`,
      to: log.args.to as `0x${string}`,
      amountAtomic: (log.args.value ?? 0n).toString(),
      amount: formatUnits(log.args.value ?? 0n, assetConfig.decimals),
      blockNumber: log.blockNumber.toString(),
    }));
  }

  async findPaymentRouterInvoicePayments(input: {
    asset: SettlementAsset;
    invoiceId: `0x${string}`;
    fromBlock: bigint;
  }): Promise<PaymentRouterInvoicePayment[]> {
    const routerAddress = this.configuration.paymentRouterAddress;
    if (!routerAddress) {
      throw new ServiceUnavailableException(
        'AVASETTLE_PAYMENT_ROUTER_ADDRESS is not configured.',
      );
    }

    const assetConfig = this.requireAsset(input.asset);
    const latestBlock = await this.publicClient.getBlockNumber();
    const configuredFromBlock =
      input.fromBlock > 0n
        ? input.fromBlock
        : latestBlock - this.configuration.payInLookbackBlocks;
    const fromBlock = configuredFromBlock > 0n ? configuredFromBlock : 0n;
    const invoicePaidEvent = parseAbiItem(
      'event InvoicePaid(bytes32 indexed invoiceId, address indexed payer, address indexed token, uint256 amount, address treasury, bytes metadata)',
    );
    const logs = await this.publicClient.getLogs({
      address: routerAddress,
      event: invoicePaidEvent,
      args: {
        invoiceId: input.invoiceId,
        token: assetConfig.address,
      },
      fromBlock,
      toBlock: 'latest',
    });

    return logs.map((log) => ({
      hash: log.transactionHash,
      invoiceId: log.args.invoiceId as `0x${string}`,
      payer: log.args.payer as `0x${string}`,
      from: log.args.payer as `0x${string}`,
      to: log.args.treasury as `0x${string}`,
      token: log.args.token as `0x${string}`,
      treasury: log.args.treasury as `0x${string}`,
      amountAtomic: (log.args.amount ?? 0n).toString(),
      amount: formatUnits(log.args.amount ?? 0n, assetConfig.decimals),
      blockNumber: log.blockNumber.toString(),
    }));
  }

  async sweepDerivedPayIn(input: {
    asset: SettlementAsset;
    derivationIndex: number;
    expectedAddress: Address;
    amountAtomic?: bigint;
  }): Promise<SweepExecution> {
    if (input.derivationIndex < 0) {
      throw new BadRequestException('Invalid pay-in derivation index.');
    }

    const treasuryAddress = this.requireTreasuryAddress();
    const account = this.derivePayInAccount(input.derivationIndex);
    if (getAddress(account.address) !== getAddress(input.expectedAddress)) {
      throw new ConflictException(
        'Derived signer does not match stored pay-in deposit address.',
      );
    }

    const nativeBalance = await this.publicClient.getBalance({
      address: account.address,
    });
    if (nativeBalance === 0n) {
      throw new ConflictException(
        'Derived deposit address has no AVAX for sweep gas.',
      );
    }

    const assetConfig = this.requireAsset(input.asset);
    const tokenBalance = await this.publicClient.readContract({
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    });
    const amountAtomic = input.amountAtomic ?? tokenBalance;
    if (amountAtomic <= 0n) {
      throw new ConflictException(
        'Derived deposit address has no token balance.',
      );
    }
    if (amountAtomic > tokenBalance) {
      throw new ConflictException(
        'Sweep amount exceeds deposit address balance.',
      );
    }

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
      args: [treasuryAddress, amountAtomic],
    });

    const hash = await walletClient.writeContract({
      address: assetConfig.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [treasuryAddress, amountAtomic],
    });

    if (!this.configuration.waitForReceipt) {
      return {
        hash,
        status: 'broadcasted',
        from: account.address,
        to: treasuryAddress,
        asset: input.asset,
        amountAtomic: amountAtomic.toString(),
        amount: formatUnits(amountAtomic, assetConfig.decimals),
      };
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return {
      hash,
      status: receipt.status === 'success' ? 'confirmed' : 'broadcasted',
      blockNumber: receipt.blockNumber.toString(),
      from: account.address,
      to: treasuryAddress,
      asset: input.asset,
      amountAtomic: amountAtomic.toString(),
      amount: formatUnits(amountAtomic, assetConfig.decimals),
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
