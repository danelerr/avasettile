import { Injectable } from '@nestjs/common';
import { ConfigurationService } from './configuration/configuration.service';

@Injectable()
export class AppService {
  constructor(private readonly configuration: ConfigurationService) {}

  getServiceMetadata() {
    return {
      service: this.configuration.serviceName,
      product: 'AvaSettle',
      role: 'avalanche-on-chain-provider',
      version: this.configuration.version,
      network: this.configuration.networkSummary,
    };
  }
}
