import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PayoutsService } from '../payouts/payouts.service';
import { RiskService } from '../risk/risk.service';
import { ChainFlowService } from './chain-flow.service';

const payout = {
  id: 'payout-id',
  externalId: 'cf-retiro-1',
  chainFlowRequestId: 'cf-retiro-1',
  status: 'prepared',
  network: 'avalanche-fuji',
  chainId: 43113,
  asset: 'USDC',
  tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  amount: '10',
  amountAtomic: '10000000',
  beneficiaryAddress: '0x1111111111111111111111111111111111111111',
  beneficiaryName: null,
  treasuryAddress: null,
  transactionHash: null,
  failureReason: null,
  memo: null,
  metadata: {},
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  authorizedAt: null,
  broadcastedAt: null,
  confirmedAt: null,
} as const;

describe('ChainFlowService', () => {
  let service: ChainFlowService;
  const payouts = {
    createPayout: jest.fn(),
    authorizePayout: jest.fn(),
    getPayout: jest.fn(),
    getPayoutByExternalId: jest.fn(),
  };
  const risk = {
    assess: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainFlowService,
        { provide: PayoutsService, useValue: payouts },
        { provide: RiskService, useValue: risk },
      ],
    }).compile();

    service = module.get(ChainFlowService);
    risk.assess.mockReturnValue({ decision: 'approve' });
    payouts.createPayout.mockResolvedValue(payout);
    payouts.authorizePayout.mockResolvedValue({
      ...payout,
      status: 'broadcasted',
      transactionHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    payouts.getPayoutByExternalId.mockReturnValue(payout);
  });

  it('maps preparar retiro aliases to a payout request', async () => {
    const response = await service.prepararRetiro(
      {
        idRetiro: 'cf-retiro-1',
        monto: '10',
        moneda: 'USDC',
        wallet: '0x1111111111111111111111111111111111111111',
      },
      {
        institutionId: 'chain-flow',
        correlationId: null,
        idempotencyKey: null,
        actor: 'chain-flow',
        sourceIp: null,
      },
    );

    expect(payouts.createPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'cf-retiro-1',
        amount: '10',
        asset: 'USDC',
        beneficiaryAddress: '0x1111111111111111111111111111111111111111',
      }),
      expect.any(Object),
    );
    expect(response).toMatchObject({
      codigo: '00',
      retiroId: 'cf-retiro-1',
      estado: 'prepared',
    });
  });

  it('rejects preparar retiro when risk rejects', async () => {
    risk.assess.mockReturnValue({ decision: 'reject' });

    await expect(
      service.prepararRetiro(
        {
          idRetiro: 'cf-retiro-1',
          monto: '100000',
          moneda: 'USDC',
          wallet: '0x1111111111111111111111111111111111111111',
        },
        {
          institutionId: 'chain-flow',
          correlationId: null,
          idempotencyKey: null,
          actor: 'chain-flow',
          sourceIp: null,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
