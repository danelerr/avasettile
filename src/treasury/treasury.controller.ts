import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { TreasuryService } from './treasury.service';

@ApiTags('treasury')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid AvaSettle API key.',
})
@Controller('v1/treasury')
@UseGuards(ApiKeyGuard)
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Inspect treasury configuration',
    description:
      'Returns non-secret treasury and settlement configuration: active Avalanche network, whether the signer is configured, treasury address, enabled token assets, confirmation policy, and receipt-waiting policy.',
  })
  @ApiOkResponse({
    description: 'Treasury configuration state.',
    schema: {
      example: {
        service: 'AvaSettle On-chain Provider',
        network: {
          key: 'avalanche-fuji',
          chainId: 43113,
          name: 'Avalanche Fuji Testnet',
          nativeTokenSymbol: 'AVAX',
          explorerBaseUrl: 'https://testnet.snowtrace.io',
          rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
        },
        treasury: {
          configured: true,
          address: '0x2222222222222222222222222222222222222222',
        },
        settlement: {
          enabledAssets: [
            {
              symbol: 'USDC',
              address: '0x5425890298aed601595a70ab815c96711a31bc65',
              decimals: 6,
              maxPayoutAmount: '1000',
              configured: true,
            },
          ],
          minConfirmations: 2,
          waitForReceipt: false,
        },
      },
    },
  })
  getStatus() {
    return this.treasury.getStatus();
  }

  @Get('balances')
  @ApiOperation({
    summary: 'Read treasury balances',
    description:
      'Reads the treasury native AVAX balance and configured ERC-20 stablecoin balances from Avalanche. Chain Flow can use this for pre-flight liquidity checks.',
  })
  @ApiOkResponse({
    description: 'Native and token balances for the configured treasury.',
    schema: {
      example: {
        network: {
          key: 'avalanche-fuji',
          chainId: 43113,
          name: 'Avalanche Fuji Testnet',
        },
        treasuryAddress: '0x2222222222222222222222222222222222222222',
        native: {
          asset: 'AVAX',
          balanceAtomic: '1000000000000000000',
          balance: '1',
        },
        assets: [
          {
            configured: true,
            asset: 'USDC',
            tokenAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
            decimals: 6,
            balanceAtomic: '250000000',
            balance: '250',
          },
        ],
      },
    },
  })
  getBalances() {
    return this.treasury.getBalances();
  }
}
