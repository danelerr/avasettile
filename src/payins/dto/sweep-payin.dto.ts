import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SweepPayInDto {
  @ApiPropertyOptional({
    example: 'Sweep confirmed pay-in into institutional treasury.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    example: '100.00',
    description:
      'Optional amount to sweep. If omitted, AvaSettle sweeps the full ERC-20 balance of the derived deposit address.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
  amount?: string;
}
