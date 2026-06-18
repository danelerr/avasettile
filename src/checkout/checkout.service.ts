import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigurationService } from '../configuration/configuration.service';
import { RequestContext } from '../payouts/payout.types';
import { PayinsService } from '../payins/payins.service';
import { PayInCollectionMode, PayInRecord } from '../payins/payins.types';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CheckoutConfig, CheckoutSessionView } from './checkout.types';

/**
 * Hosted checkout: a thin, public-facing wrapper over the pay-in engine that
 * issues PaymentRouter invoices anyone can pay from a browser and exposes only
 * the safe, non-tenant fields needed to track settlement live.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly payins: PayinsService,
    private readonly configuration: ConfigurationService,
  ) {}

  getConfig(): CheckoutConfig {
    const network = this.configuration.networkSummary;
    const asset = this.configuration.enabledAssets[0];
    const token = this.configuration.getAssetConfig(asset);
    return {
      network: this.configuration.settlementNetwork,
      chainId: network.chainId,
      networkName: network.name,
      explorerBaseUrl: network.explorerBaseUrl,
      demoEnabled: this.configuration.checkoutDemoEnabled,
      router: {
        address: this.configuration.paymentRouterAddress,
        configured: this.configuration.paymentRouterConfigured,
      },
      token: {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals,
      },
    };
  }

  async createSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionView> {
    if (!this.configuration.checkoutDemoEnabled) {
      throw new ForbiddenException('Hosted checkout is disabled.');
    }

    const asset = dto.asset ?? this.configuration.enabledAssets[0];
    const record = await this.payins.createPayIn(
      {
        externalId: `checkout-${randomUUID()}`,
        amount: dto.amount,
        asset,
        collectionMode: PayInCollectionMode.PaymentRouter,
        metadata: {
          source: 'hosted-checkout',
          reference: dto.reference ?? null,
        },
      },
      this.publicContext(),
    );

    return this.toView(record);
  }

  async getSession(id: string): Promise<CheckoutSessionView> {
    return this.toView(await this.payins.getPayIn(id, this.publicContext()));
  }

  /**
   * Re-scans the chain for this invoice on demand so the payer sees the
   * payin.detected → payin.confirmed transition without waiting for the
   * background auto-reconcile tick.
   */
  async reconcileSession(id: string): Promise<CheckoutSessionView> {
    return this.toView(
      await this.payins.reconcilePayIn(id, this.publicContext()),
    );
  }

  /**
   * An unauthenticated, tenant-less context. Pay-ins created here carry a null
   * client_id (the schema allows it and webhooks no-op for null clients), and
   * reads/reconciles run unscoped — exactly what a public invoice link needs.
   */
  private publicContext(): RequestContext {
    return {
      clientId: null,
      clientName: 'hosted-checkout',
      correlationId: null,
      idempotencyKey: null,
      actor: 'checkout',
      sourceIp: null,
    };
  }

  private toView(record: PayInRecord): CheckoutSessionView {
    const reference = record.metadata?.reference;
    return {
      id: record.id,
      status: record.status,
      asset: record.asset,
      amount: record.expectedAmount,
      amountAtomic: record.expectedAmountAtomic,
      receivedAmount: record.receivedAmount,
      network: record.network,
      chainId: record.chainId,
      tokenAddress: record.tokenAddress,
      routerAddress: record.routerAddress,
      invoiceId: record.routerInvoiceId,
      reference: typeof reference === 'string' ? reference : null,
      explorerBaseUrl: this.configuration.networkSummary.explorerBaseUrl,
      transactions: record.transfers.map((transfer) => ({
        hash: transfer.hash,
        amount: transfer.amount,
        blockNumber: transfer.blockNumber,
      })),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      detectedAt: record.detectedAt,
      confirmedAt: record.confirmedAt,
    };
  }
}
