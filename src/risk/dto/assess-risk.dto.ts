import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEthereumAddress,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { SettlementAsset } from '../../configuration/configuration.types';
import type { RiskSubjectType } from '../risk.types';

export class AssessRiskDto {
  @ApiProperty({
    enum: ['payout', 'payin', 'address'],
    example: 'payout',
  })
  @IsIn(['payout', 'payin', 'address'])
  subjectType!: RiskSubjectType;

  @ApiPropertyOptional({
    example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subjectId?: string;

  @ApiPropertyOptional({
    example: '2500.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount?: string;

  @ApiPropertyOptional({
    enum: ['USDC', 'USDT'],
    example: 'USDC',
  })
  @IsOptional()
  @IsIn(['USDC', 'USDT'])
  asset?: SettlementAsset;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsOptional()
  @IsEthereumAddress()
  address?: `0x${string}`;

  @ApiPropertyOptional({
    example: { country: 'BO', rail: 'bank-transfer' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
