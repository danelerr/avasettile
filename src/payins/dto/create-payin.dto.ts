import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { SettlementAsset } from '../../configuration/configuration.types';
import { PayInCollectionMode } from '../payins.types';

export class CreatePayInDto {
  @ApiProperty({
    example: 'chainflow-payin-0001',
    maxLength: 120,
    description:
      'Business idempotency key supplied by Chain Flow or the upstream institution.',
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  externalId!: string;

  @ApiProperty({
    example: '100.00',
    description:
      'Expected stablecoin amount to be received at the derived deposit address.',
  })
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount!: string;

  @ApiProperty({
    enum: ['USDC', 'USDT'],
    enumName: 'SettlementAsset',
    example: 'USDC',
  })
  @IsIn(['USDC', 'USDT'])
  asset!: SettlementAsset;

  @ApiPropertyOptional({
    example: 'cf-in-0001',
    maxLength: 120,
    description: 'Optional Chain Flow internal pay-in request identifier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  chainFlowRequestId?: string;

  @ApiPropertyOptional({
    enum: Object.values(PayInCollectionMode),
    example: PayInCollectionMode.DerivedAddress,
    description:
      'Collection rail. derived-address issues a unique EOA deposit address. payment-router creates a programmable invoice for PaymentRouter.sol.',
  })
  @IsOptional()
  @IsIn(Object.values(PayInCollectionMode))
  collectionMode?: PayInCollectionMode;

  @ApiPropertyOptional({
    example:
      '0x9f44d4e15d24d94f92f19543c3067f33c1b62f77dbf3dfc80f9b87d236a76b79',
    description:
      'Optional bytes32 invoice id for PaymentRouter mode. If omitted, AvaSettle hashes externalId.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  routerInvoiceId?: `0x${string}`;

  @ApiPropertyOptional({
    example: 60,
    minimum: 1,
    maximum: 10080,
    description: 'Optional expiration window in minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  expiresInMinutes?: number;

  @ApiPropertyOptional({
    example: { country: 'CO', customerReference: 'merchant-321' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
