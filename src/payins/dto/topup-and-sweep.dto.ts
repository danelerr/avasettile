import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class TopUpAndSweepDto {
  @ApiPropertyOptional({
    description:
      'AVAX amount to send to the deposit address before sweeping. Defaults to 0.002 AVAX.',
    example: '0.002',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amountAvax must be a positive decimal.' })
  amountAvax?: string;

  @ApiPropertyOptional({
    description: 'Operator note recorded in the audit trail.',
    example: 'Manual topup-and-sweep for batch close.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
