import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
