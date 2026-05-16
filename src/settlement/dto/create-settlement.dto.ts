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
import type { SettlementSourceType } from '../settlement.types';

export class CreateSettlementDto {
  @ApiProperty({ enum: ['payout', 'payin', 'manual'], example: 'payout' })
  @IsIn(['payout', 'payin', 'manual'])
  sourceType!: SettlementSourceType;

  @ApiProperty({ example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177' })
  @IsString()
  @MaxLength(120)
  sourceId!: string;

  @ApiProperty({ enum: ['USDC', 'USDT'], example: 'USDC' })
  @IsIn(['USDC', 'USDT'])
  asset!: SettlementAsset;

  @ApiProperty({ example: '25.50' })
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  cryptoAmount!: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  fiatCurrency?: string;

  @ApiPropertyOptional({ example: 'bank-transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  rail?: string;

  @ApiPropertyOptional({ example: 'settlement-batch-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ example: { country: 'BO' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
