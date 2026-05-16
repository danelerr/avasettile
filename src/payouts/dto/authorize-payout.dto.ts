import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AuthorizePayoutDto {
  @ApiPropertyOptional({
    example: 'chain-flow',
    maxLength: 120,
    description:
      'Human or system actor that approved the payout for broadcast.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  approvedBy?: string;

  @ApiPropertyOptional({
    example: 'risk-ok-0001',
    maxLength: 120,
    description:
      'Identifier of the risk/compliance decision that approved the payout.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  riskDecisionId?: string;

  @ApiPropertyOptional({
    example: 'Approved by institutional payout workflow',
    maxLength: 500,
    description: 'Optional authorization notes for audit support.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
