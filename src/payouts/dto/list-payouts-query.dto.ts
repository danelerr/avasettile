import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PayoutStatus } from '../payout.types';

export class ListPayoutsQueryDto {
  @ApiPropertyOptional({
    enum: PayoutStatus,
    enumName: 'PayoutStatus',
    example: PayoutStatus.Broadcasted,
    description: 'Filter payouts by lifecycle status.',
  })
  @IsOptional()
  @IsIn(Object.values(PayoutStatus))
  status?: PayoutStatus;

  @ApiPropertyOptional({
    example: 'chainflow-payout-0001',
    maxLength: 120,
    description:
      'Filter by the business idempotency key supplied by Chain Flow.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;

  @ApiPropertyOptional({
    default: 100,
    maximum: 1000,
    description: 'Max records to return.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({
    default: 0,
    description: 'Number of records to skip.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
