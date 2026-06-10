import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientRecord } from '../clients/client.types';
import { ClientsService } from '../clients/clients.service';
import { extractApiKey } from './extract-api-key';

export type AuthenticatedRequest = Request & {
  avasettleClient?: ClientRecord;
};

/**
 * Resolves the per-client API key to a registered, active client and attaches
 * it to the request. Every business endpoint is scoped to that client.
 */
@Injectable()
export class ClientApiKeyGuard implements CanActivate {
  constructor(private readonly clients: ClientsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('Missing AvaSettle API key.');
    }

    const client = await this.clients.resolveActiveClientByApiKey(apiKey);
    if (!client) {
      throw new UnauthorizedException('Invalid AvaSettle API key.');
    }

    request.avasettleClient = client;
    return true;
  }
}
