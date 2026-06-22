import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ClientApiKeyGuard } from '../auth/client-api-key.guard';
import type { AuthenticatedRequest } from '../auth/client-api-key.guard';
import { extractRequestContext } from '../common/request-context.util';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { SettlementsService } from './settlements.service';

/**
 * Confidential settlements via the PrivateSettlementRegistry. Client-scoped:
 * each institution only sees its own records, and the blinding nonce is never
 * returned.
 */
@ApiTags('settlements')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@ApiUnauthorizedResponse({
  description: 'Missing or invalid AvaSettle API key.',
})
@Controller('v1/settlements')
@UseGuards(ClientApiKeyGuard)
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Post()
  @ApiOperation({
    summary: 'Record a confidential settlement',
    description:
      'Publishes a hash commitment of (amount, asset, counterparty, nonce) on-chain. Only the commitment is public; the preimage stays in AvaSettle so it can be revealed to an auditor later. Requires AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS.',
  })
  record(
    @Body() dto: CreateSettlementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settlements.record(dto, extractRequestContext(request));
  }

  @Get()
  @ApiOperation({ summary: 'List confidential settlements' })
  @ApiOkResponse({
    description: 'Settlements of the calling client (newest first).',
  })
  list(
    @Query() query: ListSettlementsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settlements.list(query, extractRequestContext(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a confidential settlement by id' })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.settlements.get(id, extractRequestContext(request));
  }

  @Post(':id/reveal')
  @ApiOperation({
    summary: 'Reveal a settlement for audit',
    description:
      'The auditor attests on-chain that the record matches its preimage, leaving an immutable disclosure attestation. Requires AVASETTLE_SETTLEMENT_AUDITOR_PRIVATE_KEY.',
  })
  @ApiParam({ name: 'id', example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  reveal(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.settlements.reveal(id, extractRequestContext(request));
  }
}
