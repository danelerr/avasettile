import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Check service liveness',
    description:
      'Returns an inexpensive liveness response. Load balancers and uptime checks can use this endpoint without requiring B2B authentication.',
  })
  @ApiOkResponse({
    description: 'Service process is alive.',
    schema: {
      example: {
        status: 'ok',
        service: 'AvaSettle On-chain Provider',
        product: 'AvaSettle',
        timestamp: '2026-05-16T21:22:09.663Z',
      },
    },
  })
  getLiveness() {
    return this.health.getLiveness();
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Check operational readiness',
    description:
      'Checks whether API key, treasury signer, token contracts, storage, and RPC connectivity are configured. A degraded response means the server is alive but not ready for institutional flows.',
  })
  @ApiOkResponse({
    description: 'Readiness state for operational dependencies.',
    schema: {
      example: {
        status: 'degraded',
        network: {
          key: 'avalanche-fuji',
          chainId: 43113,
          name: 'Avalanche Fuji Testnet',
        },
        storage: {
          driver: 'json',
          configured: false,
          required: false,
        },
        checks: {
          apiKeyConfigured: true,
          treasuryConfigured: false,
          payInMnemonicConfigured: false,
          assetsConfigured: false,
          databaseReady: true,
          rpcReachable: true,
        },
        timestamp: '2026-05-16T21:22:09.663Z',
      },
    },
  })
  getReadiness() {
    return this.health.getReadiness();
  }
}
