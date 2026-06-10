import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { ReportsService } from './reports.service';

class AuditTrailQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) @Type(() => Number) limit?: number;
}

class WebhookDeliveriesQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(500) @Type(() => Number) limit?: number;
  @IsOptional() @IsBoolean() @Type(() => Boolean) failed?: boolean;
}

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

  @Get('sweep-queue')
  @ApiOperation({
    summary: 'Get confirmed pay-ins pending sweep',
    description:
      'Lists confirmed pay-ins whose sweep is still pending or failed. Useful for treasury operators to know which deposit addresses hold funds waiting to be consolidated.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        generatedAt: '2026-06-09T10:00:00.000Z',
        count: 1,
        items: [
          {
            id: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10',
            externalId: 'payin-0001',
            depositAddress: '0x1111111111111111111111111111111111111111',
            asset: 'USDC',
            receivedAmount: '100.00',
            sweepStatus: 'pending',
          },
        ],
      },
    },
  })
  getSweepQueue() {
    return this.reports.getSweepQueue();
  }

  @Get('webhook-deliveries')
  @ApiOperation({
    summary: 'List webhook delivery attempts',
    description:
      'Returns recent webhook delivery records. Requires PostgreSQL storage. Use ?failed=true to show only failures.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'failed', required: false, example: true })
  @ApiOkResponse({
    schema: {
      example: {
        generatedAt: '2026-06-09T10:00:00.000Z',
        count: 1,
        items: [
          {
            id: 'uuid',
            event: 'payin.confirmed',
            url: 'https://example.com/webhook',
            success: false,
            attempts: 3,
            lastError: 'HTTP 500',
            deliveredAt: null,
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      },
    },
  })
  getWebhookDeliveries(@Query() query: WebhookDeliveriesQueryDto) {
    return this.reports.getWebhookDeliveries(query.limit ?? 50, query.failed);
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Export audit trail',
    description:
      'Returns audit events filtered by date range, subject, and optional limit. Maximum 1000 events per call.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-09T23:59:59.999Z' })
  @ApiQuery({ name: 'subjectId', required: false, example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @ApiQuery({ name: 'limit', required: false, example: 200 })
  @ApiOkResponse({
    schema: {
      example: {
        generatedAt: '2026-06-09T10:00:00.000Z',
        count: 2,
        events: [
          {
            id: 'abc',
            type: 'PAYIN_CREATED',
            subjectId: '9d8f9b5a',
            actor: { institutionId: 'fintech-01', correlationId: null },
            payload: {},
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
      },
    },
  })
  getAuditTrail(@Query() query: AuditTrailQueryDto) {
    return this.reports.getAuditTrail(
      query.from,
      query.to,
      query.subjectId,
      query.limit,
    );
  }
}
