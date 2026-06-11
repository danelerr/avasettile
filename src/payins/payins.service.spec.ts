import { ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { DatabaseService } from '../database/database.service';
import { RequestContext } from '../payouts/payout.types';
import { WebhookService } from '../webhooks/webhook.service';
import { PayInLedgerService } from './payin-ledger.service';
import { PayinsService } from './payins.service';
import {
  PayInCollectionMode,
  PayInRecord,
  PayInStatus,
  PayInSweepStatus,
} from './payins.types';

const context: RequestContext = {
  clientId: 'client-1',
  clientName: 'Fintech LATAM SA',
  correlationId: 'corr-1',
  idempotencyKey: null,
  actor: 'ops',
  sourceIp: null,
};

const payin: PayInRecord = {
  id: 'payin-id',
  clientId: 'client-1',
  externalId: 'PAYIN-1',
  chainFlowRequestId: null,
  status: PayInStatus.Confirmed,
  network: 'avalanche-fuji',
  chainId: 43113,
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  expectedAmount: '10',
  expectedAmountAtomic: '10000000',
  receivedAmount: '10',
  receivedAmountAtomic: '10000000',
  depositAddress: '0x1111111111111111111111111111111111111111',
  derivationIndex: 7,
  collectionMode: PayInCollectionMode.DerivedAddress,
  routerAddress: null,
  routerInvoiceId: null,
  startBlock: '1',
  lastScannedBlock: null,
  expiresAt: null,
  metadata: {},
  transfers: [],
  sweepStatus: PayInSweepStatus.Pending,
  sweepTransactionHash: null,
  sweptAmount: '0',
  sweptAmountAtomic: '0',
  sweptAt: null,
  sweepFailureReason: null,
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
  detectedAt: '2026-05-17T00:00:00.000Z',
  confirmedAt: '2026-05-17T00:00:00.000Z',
  acceptedAt: null,
  acceptanceNote: null,
};

describe('PayinsService', () => {
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
    listBySubject: jest.fn().mockResolvedValue([]),
  };
  const blockchain = {
    sweepDerivedPayIn: jest.fn(),
  };
  const configuration = {
    paymentRouterAddress: '0x2222222222222222222222222222222222222222',
    getAssetConfig: jest.fn().mockReturnValue({
      symbol: 'USDC',
      address: '0x5425890298aed601595a70ab815c96711a31bc65',
      decimals: 6,
      maxPayoutAmount: null,
      configured: true,
    }),
  };
  const database = { claimNextPayInIndex: jest.fn().mockResolvedValue(7) };
  const ledger = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  const webhook = { fire: jest.fn().mockResolvedValue(undefined) };

  let service: PayinsService;

  beforeEach(() => {
    jest.clearAllMocks();
    audit.record.mockResolvedValue(undefined);
    audit.listBySubject.mockResolvedValue([]);
    ledger.findById.mockResolvedValue(payin);
    ledger.update.mockImplementation(
      (_id: string, patch: Partial<PayInRecord>) =>
        Promise.resolve({ ...payin, ...patch }),
    );
    blockchain.sweepDerivedPayIn.mockResolvedValue({
      hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      status: 'broadcasted',
      from: payin.depositAddress,
      to: '0x3333333333333333333333333333333333333333',
      asset: 'USDC',
      amount: '10',
      amountAtomic: '10000000',
    });
    service = new PayinsService(
      audit as unknown as AuditService,
      blockchain as unknown as BlockchainService,
      configuration as unknown as ConfigurationService,
      database as unknown as DatabaseService,
      ledger as unknown as PayInLedgerService,
      webhook as unknown as WebhookService,
    );
  });

  it('sweeps a derived pay-in address into treasury', async () => {
    const response = await service.sweepPayIn('payin-id', {}, context);

    expect(ledger.findById).toHaveBeenCalledWith('payin-id', 'client-1');
    expect(blockchain.sweepDerivedPayIn).toHaveBeenCalledWith({
      asset: 'USDC',
      derivationIndex: 7,
      expectedAddress: payin.depositAddress,
      amountAtomic: undefined,
    });
    expect(ledger.update).toHaveBeenCalledWith(
      'payin-id',
      expect.objectContaining({
        sweepStatus: PayInSweepStatus.Broadcasted,
        sweepTransactionHash:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        sweptAmount: '10',
        sweptAmountAtomic: '10000000',
      }),
      {
        expectedSweepStatus: [
          PayInSweepStatus.Pending,
          PayInSweepStatus.Failed,
        ],
      },
    );
    expect(response.sweepStatus).toBe(PayInSweepStatus.Broadcasted);
  });

  it('marks router pay-ins as not requiring sweep', async () => {
    ledger.findById.mockResolvedValue({
      ...payin,
      collectionMode: PayInCollectionMode.PaymentRouter,
      routerAddress: '0x2222222222222222222222222222222222222222',
      routerInvoiceId:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      depositAddress: '0x2222222222222222222222222222222222222222',
    });

    const response = await service.sweepPayIn('payin-id', {}, context);

    expect(blockchain.sweepDerivedPayIn).not.toHaveBeenCalled();
    expect(response.sweepStatus).toBe(PayInSweepStatus.NotRequired);
  });

  it('returns a failed sweep state when chain execution fails', async () => {
    blockchain.sweepDerivedPayIn.mockRejectedValueOnce(
      new ConflictException(
        'Derived deposit address has no AVAX for sweep gas.',
      ),
    );

    const response = await service.sweepPayIn('payin-id', {}, context);

    expect(response.sweepStatus).toBe(PayInSweepStatus.Failed);
    expect(response.sweepFailureReason).toContain('no AVAX');
  });
});
