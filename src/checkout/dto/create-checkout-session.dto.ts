import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { SettlementAsset } from '../../configuration/configuration.types';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: '25.00',
    description: 'Invoice amount in the chosen stablecoin (decimal string).',
  })
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount!: string;

  @ApiPropertyOptional({
    enum: ['USDC', 'USDT'],
    example: 'USDC',
    description: 'Stablecoin to charge. Defaults to the first enabled asset.',
  })
  @IsOptional()
  @IsIn(['USDC', 'USDT'])
  asset?: SettlementAsset;

  @ApiPropertyOptional({
    example: 'Pedido #1234',
    maxLength: 140,
    description:
      'Optional human-readable reference shown on the checkout page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}
