import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigurationService } from '../configuration/configuration.service';
import { extractApiKey } from './extract-api-key';

/**
 * Protects platform-operator endpoints (client management, global jobs).
 * Authenticates against AVASETTLE_ADMIN_API_KEY — never a client key.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configuration: ConfigurationService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.configuration.adminApiKeyConfigured) {
      throw new UnauthorizedException(
        'AVASETTLE_ADMIN_API_KEY is not configured.',
      );
    }

    if (!this.configuration.validateAdminApiKey(extractApiKey(request))) {
      throw new UnauthorizedException('Invalid AvaSettle admin API key.');
    }

    return true;
  }
}
