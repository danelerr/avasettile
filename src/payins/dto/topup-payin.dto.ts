import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class TopUpPayInDto {
  @ApiPropertyOptional({
    description:
      'AVAX amount to send to the deposit address. Defaults to 0.002 AVAX, which covers one USDC transfer on Avalanche C-Chain.',
    example: '0.002',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'amountAvax must be a positive decimal.',
  })
  amountAvax?: string;
}
