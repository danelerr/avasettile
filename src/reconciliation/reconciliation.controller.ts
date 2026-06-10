import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../auth/admin-api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('reconciliation')
@ApiSecurity('avasettle-admin-key')
@Controller('v1/reconciliation')
@UseGuards(AdminApiKeyGuard)
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run semi-automatic reconciliation (admin)',
    description:
      'Attempts to reconcile broadcasted payouts and open pay-ins of every client against Avalanche on-chain state. Platform-operator endpoint.',
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
  run(@Req() request: Request) {
    return this.reconciliation.run(this.toRequestContext(request));
  }

  private toRequestContext(request: Request): RequestContext {
    return {
      clientId: null,
      clientName: null,
      correlationId: this.firstHeader(request.headers['x-correlation-id']),
      idempotencyKey: null,
      actor: 'admin',
      sourceIp: request.ip ?? null,
    };
  }

  private firstHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
