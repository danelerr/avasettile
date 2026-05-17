import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key/api-key.guard';
import { RequestContext } from '../payouts/payout.types';
import { CreatePrivateSettlementDto } from './dto/create-private-settlement.dto';
import { PrivacyService } from './privacy.service';

const privateSettlementExample = {
  id: 'b5e94711-8b8f-49de-b4b0-64049f3f1e8a',
  externalId: 'privacy-settlement-0001',
  mode: 'metadata-redaction',
  status: 'created',
  subjectType: 'payin',
  subjectId: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10',
  asset: 'USDC',
  publicAmount: '100.00',
  amountCommitment:
    '7bb02a8d6a6f3da55a2d7b07f5930c5f268c3c6f6187f22c62d0f6c3358f4f07',
  counterpartyCommitment:
    '59f74c94a28a95b2041c2d6949918b34518c6bf11d8e5875fdd67c2529ebd73c',
  metadataHash:
    'c1397f77e935a4c4f72c0b1c1a4f2667532c8824c1a2e4720a6d1c2a22a613f2',
  eercContractAddress: null,
};

@ApiTags('privacy')
@ApiSecurity('avasettle-api-key')
@ApiSecurity('chain-flow-bearer')
@Controller('v1/privacy/settlements')
@UseGuards(ApiKeyGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create experimental private settlement receipt',
    description:
      'Creates an experimental privacy receipt using hashed commitments. eerc-experimental mode requires AVASETTLE_EERC_CONTRACT_ADDRESS but does not yet submit an eERC transaction.',
  })
  @ApiBody({ type: CreatePrivateSettlementDto })
  @ApiCreatedResponse({ schema: { example: privateSettlementExample } })
  create(
    @Body() dto: CreatePrivateSettlementDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Ip() sourceIp: string,
  ) {
    return this.privacy.create(dto, this.toRequestContext(headers, sourceIp));
  }

  @Get()
  @ApiOperation({ summary: 'List private settlement receipts' })
  @ApiOkResponse({ schema: { example: [privateSettlementExample] } })
  list() {
    return this.privacy.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get private settlement receipt' })
  @ApiParam({ name: 'id', example: 'b5e94711-8b8f-49de-b4b0-64049f3f1e8a' })
  @ApiOkResponse({ schema: { example: privateSettlementExample } })
  get(@Param('id') id: string) {
    return this.privacy.get(id);
  }

  private toRequestContext(
    headers: Record<string, string | string[] | undefined>,
    sourceIp: string,
  ): RequestContext {
    return {
      institutionId: this.firstHeader(headers['x-institution-id']),
      correlationId: this.firstHeader(headers['x-correlation-id']),
      idempotencyKey: this.firstHeader(headers['idempotency-key']),
      actor: this.firstHeader(headers.authorization) ? 'institution' : null,
      sourceIp,
    };
  }

  private firstHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
