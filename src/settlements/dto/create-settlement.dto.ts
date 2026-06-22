import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { SettlementAsset } from '../../configuration/configuration.types';

export class CreateSettlementDto {
  @ApiProperty({
    example: 'settlement-2026-001',
    maxLength: 120,
    description:
      'Idempotency key. Bound into the on-chain settlementId (keccak256), so a duplicate returns the existing record.',
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  externalId!: string;

  @ApiProperty({ enum: ['USDC', 'USDT'], example: 'USDC' })
  @IsIn(['USDC', 'USDT'])
  asset!: SettlementAsset;

  @ApiProperty({
    example: '1500.00',
    description:
      'Settlement amount in human units. Stays off the public ledger.',
  })
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount!: string;

  @ApiProperty({
    example: '0x1111111111111111111111111111111111111111',
    description:
      'Counterparty address. Hashed into the commitment; never published.',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  counterparty!: `0x${string}`;

  @ApiPropertyOptional({
    example: { reference: 'invoice-887', jurisdiction: 'CO' },
    description: 'Non-sensitive context echoed publicly in the on-chain event.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
