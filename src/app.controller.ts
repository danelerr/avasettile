import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Describe the provider service',
    description:
      'Returns public metadata about AvaSettle, its role, version, and active Avalanche network. This is useful for smoke tests and integration discovery.',
  })
  @ApiOkResponse({
    description: 'Provider metadata.',
    schema: {
      example: {
        service: 'AvaSettle On-chain Provider',
        product: 'AvaSettle',
        role: 'avalanche-on-chain-provider',
        version: '0.2.0',
        network: {
          key: 'avalanche-fuji',
          chainId: 43113,
          name: 'Avalanche Fuji Testnet',
          nativeTokenSymbol: 'AVAX',
          explorerBaseUrl: 'https://subnets-test.avax.network/c-chain',
          rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
        },
      },
    },
  })
  getServiceMetadata() {
    return this.appService.getServiceMetadata();
  }
}
