import { Controller, Headers, Ip, Post, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('reconciliation')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('v1/reconciliation')
@UseGuards(ApiKeyGuard)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run semi-automatic reconciliation',
    description:
      'Attempts to reconcile broadcasted payouts and open pay-ins against Avalanche on-chain state.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        startedAt: '2026-05-16T21:22:00.000Z',
        completedAt: '2026-05-16T21:22:03.000Z',
        payoutsChecked: 1,
        payinsChecked: 2,
        results: [
          { type: 'payout', id: 'payout-id', status: 'confirmed', ok: true },
        ],
      },
    },
  })
  run(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.reconciliation.run(this.toRequestContext(headers, sourceIp));
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
