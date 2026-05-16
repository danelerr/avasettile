import { Body, Controller, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('v1/risk')
@UseGuards(ApiKeyGuard)
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Post('assess')
  @ApiOperation({
    summary: 'Assess risk for a payout, pay-in, or address',
    description:
      'Runs the encapsulated AvaSettle mock risk model. This is the integration seam for a future Wavy Node provider.',
  })
  @ApiBody({ type: AssessRiskDto })
  @ApiOkResponse({
    schema: {
      example: {
        id: 'risk-uuid',
        subjectType: 'payout',
        score: 10,
        level: 'low',
        decision: 'approve',
        reasons: ['baseline_clear'],
        provider: 'avasettle-mock-risk',
      },
    },
  })
  assess(
    @Body() dto: AssessRiskDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.risk.assess(dto, this.toRequestContext(headers, sourceIp));
  }

  private toRequestContext(
    headers: Record<string, string | string[] | undefined>,
    sourceIp: string,
  ): RequestContext {
    return {
      institutionId: this.firstHeader(headers['x-institution-id']),
      correlationId: this.firstHeader(headers['x-correlation-id']),
      idempotencyKey: this.firstHeader(headers['idempotency-key']),
      actor: this.firstHeader(headers.authorization) ? 'chain-flow' : null,
      sourceIp,
    };
  }

  private firstHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
