import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class TreasurySignerService {
  private readonly _account: ReturnType<typeof privateKeyToAccount> | null;

  constructor(private readonly configuration: ConfigurationService) {
    const pk = configuration.treasuryPrivateKey;
    this._account = pk ? privateKeyToAccount(pk) : null;
  }

  get address(): Address | null {
    return this._account?.address ?? null;
  }

  get account() {
    return this._account;
  }

  requireAccount(): ReturnType<typeof privateKeyToAccount> {
    if (!this._account) {
      throw new ServiceUnavailableException(
        'AvaSettle treasury private key is not configured.',
      );
    }
    return this._account;
  }
}
