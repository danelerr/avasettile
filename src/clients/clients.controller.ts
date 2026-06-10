import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../auth/admin-api-key.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientExample = {
  id: '0b9af3a1-2f4f-4c39-9d3f-1a2b3c4d5e6f',
  name: 'Fintech LATAM SA',
  status: 'active',
  apiKeyPrefix: 'avk_1a2b3c4d',
  webhookUrl: 'https://api.fintech-latam.example/avasettle/webhooks',
  webhookSecretConfigured: true,
  metadata: { country: 'BO' },
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
};

@ApiTags('clients')
@ApiSecurity('avasettle-admin-key')
@ApiUnauthorizedResponse({ description: 'Missing or invalid admin API key.' })
@Controller('v1/admin/clients')
@UseGuards(AdminApiKeyGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a new client (institution)',
    description:
      'Creates a client and issues its API key. The plaintext key is returned only in this response — store it securely; only its hash is persisted.',
  })
  @ApiBody({ type: CreateClientDto })
  @ApiCreatedResponse({
    schema: { example: { ...clientExample, apiKey: 'avk_<48-hex-chars>' } },
  })
  createClient(@Body() dto: CreateClientDto) {
    return this.clients.createClient(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List clients' })
  @ApiOkResponse({ schema: { example: [clientExample] } })
  listClients() {
    return this.clients.listClients();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by id' })
  @ApiParam({ name: 'id', example: clientExample.id })
  @ApiOkResponse({ schema: { example: clientExample } })
  getClient(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.getClient(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a client',
    description:
      'Updates name, status (active/disabled), webhook endpoint/secret, or metadata.',
  })
  @ApiParam({ name: 'id', example: clientExample.id })
  @ApiBody({ type: UpdateClientDto })
  @ApiOkResponse({ schema: { example: clientExample } })
  updateClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.updateClient(id, dto);
  }

  @Post(':id/rotate-key')
  @ApiOperation({
    summary: 'Rotate the client API key',
    description:
      'Invalidates the current key immediately and returns the new plaintext key once.',
  })
  @ApiParam({ name: 'id', example: clientExample.id })
  @ApiOkResponse({
    schema: { example: { ...clientExample, apiKey: 'avk_<48-hex-chars>' } },
  })
  rotateApiKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.rotateApiKey(id);
  }
}
