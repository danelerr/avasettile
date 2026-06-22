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
  PublicClient,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  stringToBytes,
  keccak256,
  encodeAbiParameters,
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
import { TreasurySignerService } from './treasury-signer.service';

// Minimal SettlementVault ABI — only the methods the payout rail calls/reads.
const settlementVaultAbi = [
  {
    type: 'function',
    name: 'payout',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'payoutRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [{ name: 'payoutId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'payoutBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchRef', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [{ name: 'batchId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'funder',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

// Minimal PrivateSettlementRegistry ABI — record a commitment / reveal it.
const privateSettlementRegistryAbi = [
  {
    type: 'function',
    name: 'recordSettlement',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'settlementRef', type: 'bytes32' },
      { name: 'commitment', type: 'bytes32' },
      { name: 'publicMetadata', type: 'bytes' },
    ],
    outputs: [{ name: 'settlementId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'revealForAudit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'settlementId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'asset', type: 'address' },
      { name: 'counterparty', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

@Injectable()
export class BlockchainService {
  private readonly _publicClient: PublicClient;
  private readonly _operatorAccount: ReturnType<
    typeof privateKeyToAccount
  > | null;
  private readonly _registrarAccount: ReturnType<
    typeof privateKeyToAccount
  > | null;
  private readonly _auditorAccount: ReturnType<
    typeof privateKeyToAccount
  > | null;

  constructor(
    private readonly configuration: ConfigurationService,
    private readonly treasury: TreasurySignerService,
  ) {
    this._publicClient = createPublicClient({
      chain: this.chain,
      transport: http(configuration.networkSummary.rpcUrl),
    });
    const operatorKey = configuration.vaultOperatorPrivateKey;
    this._operatorAccount = operatorKey
      ? privateKeyToAccount(operatorKey)
      : null;
    const registrarKey = configuration.settlementRegistrarPrivateKey;
    this._registrarAccount = registrarKey
      ? privateKeyToAccount(registrarKey)
      : null;
    const auditorKey = configuration.settlementAuditorPrivateKey;
    this._auditorAccount = auditorKey ? privateKeyToAccount(auditorKey) : null;
  }

  get chain(): Chain {
    return this.configuration.settlementNetwork === 'avalanche-mainnet'
      ? avalanche
      : avalancheFuji;
  }

  get treasuryAddress(): Address | null {
    return this.treasury.address;
  }

  getLatestBlockNumber(): Promise<bigint> {
    return this._publicClient.getBlockNumber();
  }

  getChainId(): Promise<number> {
    return this._publicClient.getChainId();
  }

  derivePayInAddress(index: number): Address {
    return this.derivePayInAccount(index).address;
  }

  /**
   * Derive the per-invoice reference salt the payer passes to
   * PaymentRouter.payInvoice (the contract binds token + amount on top of it).
   * Kept stable as keccak256(externalId) so a given invoice always resolves to
   * the same reference.
   */
  routerInvoiceIdFromExternalId(externalId: string): `0x${string}` {
    return keccak256(stringToBytes(externalId));
  }

  /**
   * Recompute the on-chain invoiceId exactly as PaymentRouter does:
   *   keccak256(abi.encode(invoiceRef, token, amount))
   * Used to filter InvoicePaid logs to the one payment that matches this
   * invoice's reference, token AND exact amount.
   */
  computeRouterInvoiceId(
    invoiceRef: `0x${string}`,
    token: Address,
    amountAtomic: bigint,
  ): `0x${string}` {
    return keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [invoiceRef, token, amountAtomic],
      ),
    );
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

  async getNativeBalance(): Promise<NativeTreasuryBalance> {
    const treasuryAddress = this.requireTreasuryAddress();
    const balance = await this._publicClient.getBalance({
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
    const balance = await this._publicClient.getBalance({ address });

    return {
      asset: 'AVAX',
      balanceAtomic: balance.toString(),
      balance: formatEther(balance),
    };
  }

  async getAssetBalance(asset: SettlementAsset): Promise<TreasuryBalance> {
    const treasuryAddress = this.requireTreasuryAddress();
    const assetConfig = this.requireAsset(asset);
    const balance = await this._publicClient.readContract({
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
    const balance = await this._publicClient.readContract({
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
    toBlock?: bigint;
  }): Promise<IncomingErc20Transfer[]> {
    const assetConfig = this.requireAsset(input.asset);
    const latestBlock =
      input.toBlock ?? (await this._publicClient.getBlockNumber());
    const fromBlock =
      input.fromBlock > 0n
        ? input.fromBlock
        : latestBlock > this.configuration.payInLookbackBlocks
          ? latestBlock - this.configuration.payInLookbackBlocks
          : 0n;
    if (fromBlock > latestBlock) return [];

    const transferEvent = parseAbiItem(
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    );

    type TransferLog = {
      transactionHash: `0x${string}` | null;
      blockNumber: bigint | null;
      logIndex: number | null;
      args: { from?: `0x${string}`; to?: `0x${string}`; value?: bigint };
    };

    const logs = await this.paginateLogs<TransferLog>(
      fromBlock,
      latestBlock,
      (from, to) =>
        this._publicClient.getLogs({
          address: assetConfig.address,
          event: transferEvent,
          args: { to: input.to },
          fromBlock: from,
          toBlock: to,
        }),
    );

    return logs.map((log) => ({
      hash: log.transactionHash ?? '0x',
      logIndex: log.logIndex != null ? log.logIndex.toString() : null,
      from: log.args.from ?? '0x',
      to: log.args.to ?? '0x',
      amountAtomic: (log.args.value ?? 0n).toString(),
      amount: formatUnits(log.args.value ?? 0n, assetConfig.decimals),
      blockNumber: (log.blockNumber ?? 0n).toString(),
    }));
  }

  async findPaymentRouterInvoicePayments(input: {
    asset: SettlementAsset;
    invoiceRef: `0x${string}`;
    amountAtomic: bigint;
    fromBlock: bigint;
    toBlock?: bigint;
  }): Promise<PaymentRouterInvoicePayment[]> {
    const routerAddress = this.configuration.paymentRouterAddress;
    if (!routerAddress) {
      throw new ServiceUnavailableException(
        'AVASETTLE_PAYMENT_ROUTER_ADDRESS is not configured.',
      );
    }

    const assetConfig = this.requireAsset(input.asset);
    // The contract binds (reference, token, amount) into the invoiceId, so we
    // can match the one log for the exact expected payment. Underpayments or
    // wrong-token payments produce a different invoiceId and are ignored.
    const invoiceId = this.computeRouterInvoiceId(
      input.invoiceRef,
      assetConfig.address,
      input.amountAtomic,
    );
    const latestBlock =
      input.toBlock ?? (await this._publicClient.getBlockNumber());
    const fromBlock =
      input.fromBlock > 0n
        ? input.fromBlock
        : latestBlock > this.configuration.payInLookbackBlocks
          ? latestBlock - this.configuration.payInLookbackBlocks
          : 0n;
    if (fromBlock > latestBlock) return [];

    const invoicePaidEvent = parseAbiItem(
      'event InvoicePaid(bytes32 indexed invoiceId, address indexed payer, address indexed token, bytes32 invoiceRef, uint256 amount, address treasury, bytes metadata)',
    );

    type InvoiceLog = {
      transactionHash: `0x${string}` | null;
      blockNumber: bigint | null;
      logIndex: number | null;
      args: {
        invoiceId?: `0x${string}`;
        payer?: `0x${string}`;
        token?: `0x${string}`;
        invoiceRef?: `0x${string}`;
        amount?: bigint;
        treasury?: `0x${string}`;
      };
    };

    const logs = await this.paginateLogs<InvoiceLog>(
      fromBlock,
      latestBlock,
      (from, to) =>
        this._publicClient.getLogs({
          address: routerAddress,
          event: invoicePaidEvent,
          args: {
            invoiceId,
            token: assetConfig.address,
          },
          fromBlock: from,
          toBlock: to,
        }),
    );

    return logs.map((log) => ({
      hash: log.transactionHash ?? '0x',
      logIndex: log.logIndex != null ? log.logIndex.toString() : null,
      invoiceId: log.args.invoiceId ?? '0x',
      payer: log.args.payer ?? '0x',
      from: log.args.payer ?? '0x',
      to: log.args.treasury ?? '0x',
      token: log.args.token ?? '0x',
      treasury: log.args.treasury ?? '0x',
      amountAtomic: (log.args.amount ?? 0n).toString(),
      amount: formatUnits(log.args.amount ?? 0n, assetConfig.decimals),
      blockNumber: (log.blockNumber ?? 0n).toString(),
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

    const nativeBalance = await this._publicClient.getBalance({
      address: account.address,
    });
    if (nativeBalance === 0n) {
      throw new ConflictException(
        'Derived deposit address has no AVAX for sweep gas.',
      );
    }

    const assetConfig = this.requireAsset(input.asset);
    const tokenBalance = await this._publicClient.readContract({
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

    const receipt = await this._publicClient.waitForTransactionReceipt({
      hash,
    });
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

    const account = this.treasury.requireAccount();
    const assetConfig = this.requireAsset(input.asset);
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
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

    const receipt = await this._publicClient.waitForTransactionReceipt({
      hash,
    });
    return {
      hash,
      status: receipt.status === 'success' ? 'confirmed' : 'broadcasted',
      blockNumber: receipt.blockNumber.toString(),
    };
  }

  // ─── SettlementVault payout rail ──────────────────────────────────────────

  /**
   * Per-payout reference salt the SettlementVault binds (token, to, amount) on
   * top of. Stable as keccak256(externalId) so a payout always maps to the same
   * on-chain payoutId.
   */
  vaultPayoutRefFromExternalId(externalId: string): `0x${string}` {
    return keccak256(stringToBytes(externalId));
  }

  /**
   * Deterministic batch reference for a set of payouts. Order-independent (ids
   * are sorted) so the same set always yields the same batchId on-chain, giving
   * replay protection on top of the per-payout status guards.
   */
  batchRefFromExternalIds(externalIds: string[]): `0x${string}` {
    return keccak256(stringToBytes([...externalIds].sort().join('|')));
  }

  /** Execute a single payout through the SettlementVault (operator-signed). */
  async vaultPayout(input: {
    asset: SettlementAsset;
    payoutRef: `0x${string}`;
    to: Address;
    amountAtomic: bigint;
    metadata?: `0x${string}`;
  }): Promise<TransferExecution> {
    if (!isAddress(input.to)) {
      throw new BadRequestException(
        'Beneficiary address is not a valid EVM address.',
      );
    }
    const vault = this.requireVaultAddress();
    const assetConfig = this.requireAsset(input.asset);
    await this.ensureVaultAllowance(
      vault,
      assetConfig.address,
      input.amountAtomic,
    );

    const walletClient = createWalletClient({
      account: this.requireVaultOperatorAccount(),
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });
    const hash = await walletClient.writeContract({
      address: vault,
      abi: settlementVaultAbi,
      functionName: 'payout',
      args: [
        input.payoutRef,
        assetConfig.address,
        input.to,
        input.amountAtomic,
        input.metadata ?? '0x',
      ],
    });
    return this.toTransferExecution(hash);
  }

  /** Execute many same-token payouts atomically through the SettlementVault. */
  async vaultPayoutBatch(input: {
    asset: SettlementAsset;
    batchRef: `0x${string}`;
    recipients: Address[];
    amountsAtomic: bigint[];
    metadata?: `0x${string}`;
  }): Promise<TransferExecution> {
    const vault = this.requireVaultAddress();
    const assetConfig = this.requireAsset(input.asset);
    for (const to of input.recipients) {
      if (!isAddress(to)) {
        throw new BadRequestException(
          `Invalid beneficiary address: ${String(to)}.`,
        );
      }
    }
    const total = input.amountsAtomic.reduce((sum, a) => sum + a, 0n);
    await this.ensureVaultAllowance(vault, assetConfig.address, total);

    const walletClient = createWalletClient({
      account: this.requireVaultOperatorAccount(),
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });
    const hash = await walletClient.writeContract({
      address: vault,
      abi: settlementVaultAbi,
      functionName: 'payoutBatch',
      args: [
        input.batchRef,
        assetConfig.address,
        input.recipients,
        input.amountsAtomic,
        input.metadata ?? '0x',
      ],
    });
    return this.toTransferExecution(hash);
  }

  private async toTransferExecution(hash: Hash): Promise<TransferExecution> {
    if (!this.configuration.waitForReceipt) {
      return { hash, status: 'broadcasted' };
    }
    const receipt = await this._publicClient.waitForTransactionReceipt({
      hash,
    });
    return {
      hash,
      status: receipt.status === 'success' ? 'confirmed' : 'broadcasted',
      blockNumber: receipt.blockNumber.toString(),
    };
  }

  private requireVaultAddress(): Address {
    const addr = this.configuration.settlementVaultAddress;
    if (!addr) {
      throw new ServiceUnavailableException(
        'AVASETTLE_SETTLEMENT_VAULT_ADDRESS is not configured.',
      );
    }
    return addr;
  }

  private requireVaultOperatorAccount() {
    return this._operatorAccount ?? this.treasury.requireAccount();
  }

  /**
   * The vault pulls funds from its funder via transferFrom, so the funder must
   * have approved the vault for `amount`. Surface a clear, actionable error
   * instead of letting the on-chain call revert opaquely.
   */
  private async ensureVaultAllowance(
    vault: Address,
    token: Address,
    amount: bigint,
  ): Promise<void> {
    const funder = await this._publicClient.readContract({
      address: vault,
      abi: settlementVaultAbi,
      functionName: 'funder',
    });
    const allowance = await this._publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [funder, vault],
    });
    if (allowance < amount) {
      throw new ConflictException(
        `SettlementVault funder ${funder} has not approved enough of ${token} ` +
          `(allowance ${allowance.toString()} < ${amount.toString()}). ` +
          `Approve the vault from the funder treasury.`,
      );
    }
  }

  // ─── PrivateSettlementRegistry (confidential settlements) ─────────────────

  /** Stable reference salt for a settlement (keccak256 of the external id). */
  settlementRefFromExternalId(externalId: string): `0x${string}` {
    return keccak256(stringToBytes(externalId));
  }

  /** On-chain settlementId exactly as the registry derives it. */
  computeSettlementId(settlementRef: `0x${string}`): `0x${string}` {
    return keccak256(
      encodeAbiParameters([{ type: 'bytes32' }], [settlementRef]),
    );
  }

  /**
   * Commitment exactly as the registry derives it:
   *   keccak256(abi.encode(amount, asset, counterparty, nonce))
   * The `nonce` blinds the commitment against dictionary attacks on the amount.
   */
  computeSettlementCommitment(
    amountAtomic: bigint,
    asset: Address,
    counterparty: Address,
    nonce: `0x${string}`,
  ): `0x${string}` {
    return keccak256(
      encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'bytes32' },
        ],
        [amountAtomic, asset, counterparty, nonce],
      ),
    );
  }

  /** Publish a private settlement commitment (registrar-signed). */
  async recordPrivateSettlement(input: {
    settlementRef: `0x${string}`;
    commitment: `0x${string}`;
    publicMetadata?: `0x${string}`;
  }): Promise<TransferExecution> {
    const registry = this.requireRegistryAddress();
    const walletClient = createWalletClient({
      account: this.requireRegistrarAccount(),
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });
    const hash = await walletClient.writeContract({
      address: registry,
      abi: privateSettlementRegistryAbi,
      functionName: 'recordSettlement',
      args: [
        input.settlementRef,
        input.commitment,
        input.publicMetadata ?? '0x',
      ],
    });
    return this.toTransferExecution(hash);
  }

  /** Reveal a settlement's preimage on-chain for audit (auditor-signed). */
  async revealPrivateSettlement(input: {
    settlementId: `0x${string}`;
    amountAtomic: bigint;
    asset: Address;
    counterparty: Address;
    nonce: `0x${string}`;
  }): Promise<TransferExecution> {
    const registry = this.requireRegistryAddress();
    const walletClient = createWalletClient({
      account: this.requireAuditorAccount(),
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });
    const hash = await walletClient.writeContract({
      address: registry,
      abi: privateSettlementRegistryAbi,
      functionName: 'revealForAudit',
      args: [
        input.settlementId,
        input.amountAtomic,
        input.asset,
        input.counterparty,
        input.nonce,
      ],
    });
    return this.toTransferExecution(hash);
  }

  private requireRegistryAddress(): Address {
    const addr = this.configuration.privateSettlementRegistryAddress;
    if (!addr) {
      throw new ServiceUnavailableException(
        'AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS is not configured.',
      );
    }
    return addr;
  }

  private requireRegistrarAccount() {
    if (!this._registrarAccount) {
      throw new ServiceUnavailableException(
        'AVASETTLE_SETTLEMENT_REGISTRAR_PRIVATE_KEY is not configured.',
      );
    }
    return this._registrarAccount;
  }

  private requireAuditorAccount() {
    if (!this._auditorAccount) {
      throw new ServiceUnavailableException(
        'AVASETTLE_SETTLEMENT_AUDITOR_PRIVATE_KEY is not configured.',
      );
    }
    return this._auditorAccount;
  }

  async sendNativeTransfer(
    to: Address,
    amountWei: bigint,
  ): Promise<{ hash: Hash; status: 'broadcasted' | 'confirmed' }> {
    if (!isAddress(to)) {
      throw new BadRequestException('Recipient is not a valid EVM address.');
    }

    const account = this.treasury.requireAccount();
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http(this.configuration.networkSummary.rpcUrl),
    });

    const nativeBalance = await this._publicClient.getBalance({
      address: account.address,
    });
    if (nativeBalance < amountWei) {
      throw new ConflictException(
        'Treasury has insufficient AVAX balance for top-up.',
      );
    }

    const hash = await walletClient.sendTransaction({ to, value: amountWei });

    if (!this.configuration.waitForReceipt) {
      return { hash, status: 'broadcasted' };
    }

    const receipt = await this._publicClient.waitForTransactionReceipt({
      hash,
    });
    return {
      hash,
      status: receipt.status === 'success' ? 'confirmed' : 'broadcasted',
    };
  }

  waitForTransaction(hash: Hash): Promise<void> {
    return this._publicClient
      .waitForTransactionReceipt({ hash })
      .then(() => undefined);
  }

  async reconcileTransaction(hash: Hash): Promise<TransactionReconciliation> {
    const receipt = await this._publicClient
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

    const latestBlock = await this._publicClient.getBlockNumber();
    const confirmations =
      latestBlock > receipt.blockNumber
        ? Number(latestBlock - receipt.blockNumber)
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

  private async paginateLogs<T>(
    fromBlock: bigint,
    toBlock: bigint,
    fetchChunk: (from: bigint, to: bigint) => Promise<T[]>,
    chunkSize = 2_000n,
  ): Promise<T[]> {
    if (fromBlock > toBlock) return [];
    const results: T[] = [];
    for (let from = fromBlock; from <= toBlock; from += chunkSize) {
      const to =
        from + chunkSize - 1n < toBlock ? from + chunkSize - 1n : toBlock;
      const chunk = await fetchChunk(from, to);
      results.push(...chunk);
    }
    return results;
  }

  private requireTreasuryAddress(): Address {
    const addr = this.treasury.address;
    if (!addr) {
      throw new ServiceUnavailableException(
        'AvaSettle treasury private key is not configured.',
      );
    }
    return addr;
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
