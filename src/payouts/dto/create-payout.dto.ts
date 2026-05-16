import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEthereumAddress,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { SettlementAsset } from '../../configuration/configuration.types';

export class CreatePayoutDto {
  @ApiProperty({
    example: 'chainflow-payout-0001',
    maxLength: 120,
    description:
      'Business idempotency key supplied by Chain Flow. Reusing it returns the existing payout instead of creating a duplicate.',
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  externalId!: string;

  @ApiProperty({
    example: '25.50',
    description:
      'Human-readable token amount. It is converted to atomic units using the configured token decimals.',
  })
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount!: string;

  @ApiProperty({
    enum: ['USDC', 'USDT'],
    enumName: 'SettlementAsset',
    example: 'USDC',
    description: 'Stablecoin asset to transfer from the AvaSettle treasury.',
  })
  @IsIn(['USDC', 'USDT'])
  asset!: SettlementAsset;

  @ApiProperty({
    example: '0x1111111111111111111111111111111111111111',
    description: 'EVM address that receives the payout on Avalanche C-Chain.',
  })
  @IsEthereumAddress()
  beneficiaryAddress!: `0x${string}`;

  @ApiPropertyOptional({
    example: 'Cliente LATAM',
    maxLength: 120,
    description:
      'Human-readable beneficiary label for audit and support workflows.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  beneficiaryName?: string;

  @ApiPropertyOptional({
    example: 'cf-req-0001',
    maxLength: 120,
    description: 'Optional Chain Flow internal payout/request identifier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  chainFlowRequestId?: string;

  @ApiPropertyOptional({
    example: 'Payout approved by Chain Flow',
    maxLength: 500,
    description: 'Operational memo stored with the payout record.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @ApiPropertyOptional({
    example: { country: 'BO', fiatRail: 'bank-transfer' },
    description:
      'Free-form structured metadata from the upstream institutional workflow.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: false,
    description:
      'If true, AvaSettle prepares and immediately authorizes/broadcasts the payout in one call.',
  })
  @IsOptional()
  @IsBoolean()
  executeImmediately?: boolean;
}
