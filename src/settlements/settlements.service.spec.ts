import { ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { SettlementsRepository } from './settlements.repository';
import { SettlementsService } from './settlements.service';
import {
  PrivateSettlementRecord,
  PrivateSettlementStatus,
} from './settlements.types';

const context: RequestContext = {
  clientId: 'client-1',
  clientName: 'Fintech LATAM SA',
  correlationId: 'corr-1',
  idempotencyKey: null,
  actor: 'ops',
  sourceIp: null,
};

const TX =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

const record: PrivateSettlementRecord = {
  id: 'settlement-id',
  clientId: 'client-1',
  externalId: 'SETTLE-1',
  settlementId: '0xset',
  settlementRef: '0xref',
  commitment: '0xcommit',
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  amount: '1500.00',
  amountAtomic: '1500000000',
  counterparty: '0x1111111111111111111111111111111111111111',
  nonce: '0xdeadbeef',
  status: PrivateSettlementStatus.Recorded,
  transactionHash: null,
  revealTransactionHash: null,
  metadata: {},
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
};

describe('SettlementsService', () => {
  const audit = { record: jest.fn(), listBySubject: jest.fn() };
  const blockchain = {
    settlementRefFromExternalId: jest.fn().mockReturnValue('0xref'),
    computeSettlementId: jest.fn().mockReturnValue('0xset'),
    computeSettlementCommitment: jest.fn().mockReturnValue('0xcommit'),
    recordPrivateSettlement: jest.fn(),
    revealPrivateSettlement: jest.fn(),
  };
  const configuration = {
    privateSettlementRegistryConfigured: true,
    getAssetConfig: jest.fn().mockReturnValue({
      symbol: 'USDC',
      address: '0x5425890298aed601595a70ab815c96711a31bc65',
      decimals: 6,
      maxPayoutAmount: null,
      configured: true,
    }),
  };
  const repository = {
    createOrGetExisting: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
  };

  let service: SettlementsService;

  beforeEach(() => {
    jest.clearAllMocks();
    audit.record.mockResolvedValue(undefined);
    configuration.privateSettlementRegistryConfigured = true;
    repository.createOrGetExisting.mockResolvedValue({
      record,
      existed: false,
    });
    repository.update.mockResolvedValue({ ...record, transactionHash: TX });
    repository.delete.mockResolvedValue(undefined);
    blockchain.recordPrivateSettlement.mockResolvedValue({
      hash: TX,
      status: 'broadcasted',
    });
    blockchain.revealPrivateSettlement.mockResolvedValue({
      hash: TX,
      status: 'broadcasted',
    });
    service = new SettlementsService(
      audit as unknown as AuditService,
      blockchain as unknown as BlockchainService,
      configuration as unknown as ConfigurationService,
      repository as unknown as SettlementsRepository,
    );
  });

  const dto = {
    externalId: 'SETTLE-1',
    asset: 'USDC' as const,
    amount: '1500.00',
    counterparty: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  };

  it('records a commitment on-chain and never returns the nonce', async () => {
    const response = await service.record(dto, context);

    expect(blockchain.recordPrivateSettlement).toHaveBeenCalledWith({
      settlementRef: '0xref',
      commitment: '0xcommit',
    });
    expect(repository.update).toHaveBeenCalledWith('settlement-id', {
      transactionHash: TX,
    });
    expect(response).not.toHaveProperty('nonce');
    expect(response.commitment).toBe('0xcommit');
  });

  it('is idempotent: an existing record skips the on-chain call', async () => {
    repository.createOrGetExisting.mockResolvedValueOnce({
      record,
      existed: true,
    });

    const response = await service.record(dto, context);

    expect(blockchain.recordPrivateSettlement).not.toHaveBeenCalled();
    expect(response.idempotentReplay).toBe(true);
  });

  it('rolls back the claim when the on-chain record fails', async () => {
    blockchain.recordPrivateSettlement.mockRejectedValueOnce(
      new Error('registrar key not configured'),
    );

    await expect(service.record(dto, context)).rejects.toThrow('registrar');
    expect(repository.delete).toHaveBeenCalledWith('settlement-id');
  });

  it('refuses to record when the registry is not configured', async () => {
    configuration.privateSettlementRegistryConfigured = false;

    await expect(service.record(dto, context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.createOrGetExisting).not.toHaveBeenCalled();
  });

  it('reveals a settlement for audit', async () => {
    repository.findById.mockResolvedValue(record);
    repository.update.mockResolvedValue({
      ...record,
      status: PrivateSettlementStatus.Revealed,
      revealTransactionHash: TX,
    });

    const response = await service.reveal('settlement-id', context);

    expect(blockchain.revealPrivateSettlement).toHaveBeenCalledWith({
      settlementId: '0xset',
      amountAtomic: 1500000000n,
      asset: record.tokenAddress,
      counterparty: record.counterparty,
      nonce: record.nonce,
    });
    expect(response.status).toBe(PrivateSettlementStatus.Revealed);
    expect(response).not.toHaveProperty('nonce');
  });
});
