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
import type { PrivateSettlementMode } from '../privacy.types';

export class CreatePrivateSettlementDto {
  @ApiProperty({
    example: 'privacy-settlement-0001',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  externalId!: string;

  @ApiProperty({
    enum: ['metadata-redaction', 'eerc-experimental'],
    example: 'metadata-redaction',
  })
  @IsIn(['metadata-redaction', 'eerc-experimental'])
  mode!: PrivateSettlementMode;

  @ApiProperty({
    enum: ['payin', 'payout', 'settlement', 'manual'],
    example: 'payin',
  })
  @IsIn(['payin', 'payout', 'settlement', 'manual'])
  subjectType!: 'payin' | 'payout' | 'settlement' | 'manual';

  @ApiPropertyOptional({ example: '9d8f9b5a-1e0c-4ef7-8e67-7f8d9c2d8d10' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subjectId?: string;

  @ApiProperty({ enum: ['USDC', 'USDT'], example: 'USDC' })
  @IsIn(['USDC', 'USDT'])
  asset!: SettlementAsset;

  @ApiPropertyOptional({
    example: '100.00',
    description:
      'Optional public amount. Omit it for privacy demos that only expose the commitment.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount?: string;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  counterparty?: string;

  @ApiPropertyOptional({ example: { country: 'BO', invoice: 'INV-001' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
