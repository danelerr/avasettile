import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { WebhookService } from '../webhooks/webhook.service';
import { PayoutLedgerService } from './payout-ledger.service';
import { PayoutsService } from './payouts.service';
import { PayoutRecord, PayoutStatus, RequestContext } from './payout.types';

const context: RequestContext = {
  clientId: 'client-1',
  clientName: 'Fintech LATAM SA',
  correlationId: 'corr-1',
  idempotencyKey: null,
  actor: 'ops',
  sourceIp: null,
};

const payout: PayoutRecord = {
  id: 'payout-id',
  clientId: 'client-1',
  externalId: 'PAYOUT-1',
  chainFlowRequestId: null,
  status: PayoutStatus.Prepared,
  network: 'avalanche-fuji',
  chainId: 43113,
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  amount: '10',
  amountAtomic: '10000000',
  beneficiaryAddress: '0x1111111111111111111111111111111111111111',
  beneficiaryName: null,
  treasuryAddress: '0x2222222222222222222222222222222222222222',
  transactionHash: null,
  failureReason: null,
  memo: null,
  metadata: {},
  createdAt: '2026-06-10T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z',
  authorizedAt: null,
  broadcastedAt: null,
  confirmedAt: null,
};

describe('PayoutsService — authorize transition', () => {
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
    listBySubject: jest.fn().mockResolvedValue([]),
  };
  const blockchain = {
    getAssetBalance: jest.fn(),
    sendErc20Transfer: jest.fn(),
    treasuryAddress: '0x2222222222222222222222222222222222222222',
  };
  const configuration = {
    getAssetConfig: jest.fn().mockReturnValue({
      symbol: 'USDC',
      address: '0x5425890298aed601595a70ab815c96711a31bc65',
      decimals: 6,
      maxPayoutAmount: null,
      configured: true,
    }),
  };
  const ledger = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const webhook = { enqueue: jest.fn().mockResolvedValue(undefined) };

  let service: PayoutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    audit.record.mockResolvedValue(undefined);
    audit.listBySubject.mockResolvedValue([]);
    webhook.enqueue.mockResolvedValue(undefined);
    ledger.findById.mockResolvedValue(payout);
    blockchain.getAssetBalance.mockResolvedValue({
      asset: 'USDC',
      balanceAtomic: '100000000',
      balance: '100',
    });
    blockchain.sendErc20Transfer.mockResolvedValue({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'broadcasted',
    });
    service = new PayoutsService(
      audit as unknown as AuditService,
      blockchain as unknown as BlockchainService,
      configuration as unknown as ConfigurationService,
      ledger as unknown as PayoutLedgerService,
      webhook as unknown as WebhookService,
    );
  });

  it('claims prepared → authorized with a status guard before broadcasting', async () => {
    ledger.update
      .mockResolvedValueOnce({ ...payout, status: PayoutStatus.Authorized })
      .mockResolvedValueOnce({
        ...payout,
        status: PayoutStatus.Broadcasted,
        transactionHash: '0xaaa',
      });

    const response = await service.authorizePayout('payout-id', {}, context);

    expect(ledger.update).toHaveBeenNthCalledWith(
      1,
      'payout-id',
      expect.objectContaining({ status: PayoutStatus.Authorized }),
      { expectedStatus: [PayoutStatus.Prepared] },
    );
    expect(blockchain.sendErc20Transfer).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(PayoutStatus.Broadcasted);
  });

  it('never broadcasts when another request won the authorization race', async () => {
    // The guarded transition returns null: someone else moved the payout.
    ledger.update.mockResolvedValueOnce(null);
    ledger.findById
      .mockResolvedValueOnce(payout) // initial read: still looked prepared
      .mockResolvedValueOnce({
        ...payout,
        status: PayoutStatus.Broadcasted,
        transactionHash: '0xbbb',
      });

    const response = await service.authorizePayout('payout-id', {}, context);

    expect(blockchain.sendErc20Transfer).not.toHaveBeenCalled();
    expect(response.idempotentReplay).toBe(true);
    expect(response.status).toBe(PayoutStatus.Broadcasted);
  });

  it('conflicts when the payout is in a non-authorizable state', async () => {
    ledger.update.mockResolvedValueOnce(null);
    ledger.findById
      .mockResolvedValueOnce(payout)
      .mockResolvedValueOnce({ ...payout, status: PayoutStatus.Failed });

    await expect(
      service.authorizePayout('payout-id', {}, context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blockchain.sendErc20Transfer).not.toHaveBeenCalled();
  });

  it('replays immediately when the payout was already broadcasted', async () => {
    ledger.findById.mockResolvedValueOnce({
      ...payout,
      status: PayoutStatus.Broadcasted,
      transactionHash: '0xccc',
    });

    const response = await service.authorizePayout('payout-id', {}, context);

    expect(ledger.update).not.toHaveBeenCalled();
    expect(blockchain.sendErc20Transfer).not.toHaveBeenCalled();
    expect(response.idempotentReplay).toBe(true);
  });
});

describe('PayoutsService — SettlementVault rail', () => {
  const TX =
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const audit = {
    record: jest.fn(),
    listBySubject: jest.fn(),
  };
  const blockchain = {
    getAssetBalance: jest.fn(),
    sendErc20Transfer: jest.fn(),
    vaultPayout: jest.fn(),
    vaultPayoutBatch: jest.fn(),
    vaultPayoutRefFromExternalId: jest.fn(),
    batchRefFromExternalIds: jest.fn(),
    treasuryAddress: '0x2222222222222222222222222222222222222222',
  };
  const configuration = {
    getAssetConfig: jest.fn().mockReturnValue({
      symbol: 'USDC',
      address: '0x5425890298aed601595a70ab815c96711a31bc65',
      decimals: 6,
      maxPayoutAmount: null,
      configured: true,
    }),
    settlementVaultConfigured: true,
  };
  const ledger = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const webhook = { enqueue: jest.fn() };

  let service: PayoutsService;

  const prepared = (over: Partial<PayoutRecord>): PayoutRecord => ({
    ...payout,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    audit.record.mockResolvedValue(undefined);
    audit.listBySubject.mockResolvedValue([]);
    webhook.enqueue.mockResolvedValue(undefined);
    configuration.settlementVaultConfigured = true;
    blockchain.getAssetBalance.mockResolvedValue({
      asset: 'USDC',
      balanceAtomic: '100000000',
      balance: '100',
    });
    blockchain.vaultPayout.mockResolvedValue({
      hash: TX,
      status: 'broadcasted',
    });
    blockchain.vaultPayoutBatch.mockResolvedValue({
      hash: TX,
      status: 'broadcasted',
    });
    blockchain.vaultPayoutRefFromExternalId.mockReturnValue('0xref');
    blockchain.batchRefFromExternalIds.mockReturnValue('0xbatchref');
    // The guarded update echoes the patch back onto the matching record.
    ledger.update.mockImplementation(
      (id: string, patch: Partial<PayoutRecord>) =>
        Promise.resolve({ ...payout, id, ...patch }),
    );
    service = new PayoutsService(
      audit as unknown as AuditService,
      blockchain as unknown as BlockchainService,
      configuration as unknown as ConfigurationService,
      ledger as unknown as PayoutLedgerService,
      webhook as unknown as WebhookService,
    );
  });

  it('routes a single authorize through the vault, not a direct transfer', async () => {
    ledger.findById.mockResolvedValue(payout);

    const response = await service.authorizePayout('payout-id', {}, context);

    expect(blockchain.vaultPayout).toHaveBeenCalledTimes(1);
    expect(blockchain.sendErc20Transfer).not.toHaveBeenCalled();
    expect(response.status).toBe(PayoutStatus.Broadcasted);
  });

  it('settles a batch of prepared payouts atomically through the vault', async () => {
    const p1 = prepared({
      id: 'p1',
      externalId: 'PO-1',
      beneficiaryAddress: '0x1111111111111111111111111111111111111111',
      amountAtomic: '10000000',
    });
    const p2 = prepared({
      id: 'p2',
      externalId: 'PO-2',
      beneficiaryAddress: '0x3333333333333333333333333333333333333333',
      amountAtomic: '20000000',
    });
    ledger.findById.mockImplementation((id: string) =>
      Promise.resolve(id === 'p1' ? p1 : p2),
    );
    ledger.update.mockImplementation(
      (id: string, patch: Partial<PayoutRecord>) =>
        Promise.resolve({ ...(id === 'p1' ? p1 : p2), ...patch }),
    );

    const result = await service.authorizePayoutBatch(
      ['p1', 'p2'],
      {},
      context,
    );

    expect(blockchain.vaultPayoutBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        asset: 'USDC',
        recipients: [p1.beneficiaryAddress, p2.beneficiaryAddress],
        amountsAtomic: [10000000n, 20000000n],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === PayoutStatus.Broadcasted)).toBe(
      true,
    );
    expect(result.every((r) => r.transactionHash === TX)).toBe(true);
  });

  it('rejects a batch with mixed assets before touching the chain', async () => {
    ledger.findById.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'p1'
          ? prepared({ id: 'p1', asset: 'USDC' })
          : prepared({ id: 'p2', asset: 'USDT' }),
      ),
    );

    await expect(
      service.authorizePayoutBatch(['p1', 'p2'], {}, context),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(blockchain.vaultPayoutBatch).not.toHaveBeenCalled();
  });

  it('rejects a batch when any payout is not prepared', async () => {
    ledger.findById.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'p1'
          ? prepared({ id: 'p1' })
          : prepared({ id: 'p2', status: PayoutStatus.Broadcasted }),
      ),
    );

    await expect(
      service.authorizePayoutBatch(['p1', 'p2'], {}, context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blockchain.vaultPayoutBatch).not.toHaveBeenCalled();
  });

  it('rejects a batch when the vault is not configured', async () => {
    configuration.settlementVaultConfigured = false;

    await expect(
      service.authorizePayoutBatch(['p1'], {}, context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
