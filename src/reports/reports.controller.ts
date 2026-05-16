import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('v1/reports')
@UseGuards(ApiKeyGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get institutional summary report',
    description:
      'Returns operational counts and volumes for payouts, pay-ins, and simulated fiat settlements.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        generatedAt: '2026-05-16T21:22:00.000Z',
        payouts: {
          count: 2,
          byStatus: { confirmed: 1, broadcasted: 1 },
          volumeByAsset: { USDC: '125.50' },
        },
        payins: {
          count: 1,
          byStatus: { confirmed: 1 },
          expectedVolumeByAsset: { USDC: '100.00' },
          receivedVolumeByAsset: { USDC: '100.00' },
        },
      },
    },
  })
  getSummary() {
    return this.reports.getInstitutionalSummary();
  }
}
