import { Test, TestingModule } from '@nestjs/testing';
import { CreatePayoutDto } from '../payouts/dto/create-payout.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { RequestContext } from '../payouts/payout.types';
import { ChainFlowService } from './chain-flow.service';

const context: RequestContext = {
  clientId: 'client-1',
  clientName: 'Chain Flow',
  correlationId: null,
  idempotencyKey: null,
  actor: 'chain-flow',
  sourceIp: null,
};

const payout = {
  id: 'payout-id',
  clientId: 'client-1',
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
    listPayouts: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainFlowService,
        { provide: PayoutsService, useValue: payouts },
      ],
    }).compile();

    service = module.get(ChainFlowService);
    payouts.createPayout.mockResolvedValue(payout);
    payouts.authorizePayout.mockResolvedValue({
      ...payout,
      status: 'broadcasted',
      transactionHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    payouts.getPayoutByExternalId.mockResolvedValue(payout);
    payouts.listPayouts.mockResolvedValue([payout]);
  });

  it('maps AvaSettle fallback fields to a payout request', async () => {
    const response = await service.prepararRetiro(
      {
        externalId: 'cf-retiro-1',
        amount: '10',
        asset: 'USDC',
        beneficiaryAddress: '0x1111111111111111111111111111111111111111',
      },
      context,
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
      estadoChainFlow: 'PREPARADO',
    });
  });

  it('maps the exact Chain Flow retiro payload to a payout request', async () => {
    payouts.createPayout.mockResolvedValueOnce({
      ...payout,
      externalId: 'EXT-0001',
      chainFlowRequestId: '12345',
      amount: '10',
      asset: 'USDC',
      beneficiaryAddress: '0x1111111111111111111111111111111111111111',
      metadata: {
        source: 'chain-flow-compat',
        chainFlow: {
          tcTransaccionExterna: 'EXT-0001',
          tnRetiroPago: 12345,
          tnTransferenciaBloque: 9001,
          tnProcesadorPagos: 3,
          tnMoneda: 1,
          tcCuentaDestino: '0x1111111111111111111111111111111111111111',
        },
      },
    });

    const response = await service.prepararRetiro(
      {
        tcTransaccionExterna: 'EXT-0001',
        tnMonto: 10,
        tnMoneda: 1,
        tcCuentaDestino: '0x1111111111111111111111111111111111111111',
        tnRetiroPago: 12345,
        tnTransferenciaBloque: 9001,
        tnProcesadorPagos: 3,
      },
      { ...context, correlationId: 'EXT-0001', idempotencyKey: 'EXT-0001' },
    );

    const [[createdDto]] = payouts.createPayout.mock.calls as [
      [CreatePayoutDto, RequestContext],
    ];
    expect(createdDto).toMatchObject({
      externalId: 'EXT-0001',
      amount: '10',
      asset: 'USDC',
      beneficiaryAddress: '0x1111111111111111111111111111111111111111',
      chainFlowRequestId: '12345',
    });
    expect(createdDto.metadata).toMatchObject({
      source: 'chain-flow-compat',
      chainFlow: {
        tcTransaccionExterna: 'EXT-0001',
        tnRetiroPago: 12345,
        tnTransferenciaBloque: 9001,
        tnProcesadorPagos: 3,
        tnMoneda: 1,
        tcCuentaDestino: '0x1111111111111111111111111111111111111111',
      },
    });
    expect(response).toMatchObject({
      codigo: '00',
      tcTransaccionExterna: 'EXT-0001',
      tnRetiroPago: 12345,
      tnTransferenciaBloque: 9001,
      tnProcesadorPagos: 3,
      tnMoneda: 1,
      retiroId: 'EXT-0001',
      estadoChainFlow: 'PREPARADO',
    });
  });

  it('can resolve status by Chain Flow retiro payment id metadata', async () => {
    const metadataPayout = {
      ...payout,
      externalId: 'EXT-0001',
      metadata: {
        chainFlow: {
          tcTransaccionExterna: 'EXT-0001',
          tnRetiroPago: 12345,
        },
      },
    };
    payouts.getPayoutByExternalId.mockResolvedValueOnce(null);
    payouts.listPayouts.mockResolvedValueOnce([metadataPayout]);

    const response = await service.consultarEstadoRetiro(
      { tnRetiroPago: 12345 },
      context,
    );

    expect(response).toMatchObject({
      codigo: '00',
      tcTransaccionExterna: 'EXT-0001',
      tnRetiroPago: 12345,
      estado: 'prepared',
    });
  });
});
