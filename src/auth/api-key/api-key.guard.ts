import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigurationService } from '../../configuration/configuration.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configuration: ConfigurationService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey =
      this.getSingleHeader(request.headers['x-avasettle-api-key']) ??
      this.getBearerToken(request.headers.authorization);

    if (!this.configuration.apiKeyConfigured) {
      throw new UnauthorizedException('AvaSettle API key is not configured.');
    }

    if (!this.configuration.validateApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid AvaSettle API key.');
    }

    return true;
  }

  private getBearerToken(header: string | undefined): string | undefined {
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim();
  }

  private getSingleHeader(
    header: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(header)) return header[0];
    return header;
  }
}
