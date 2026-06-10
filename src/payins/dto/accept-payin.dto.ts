import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptPayInDto {
  @ApiPropertyOptional({
    description:
      'Operator note explaining acceptance of the partial or excess payment.',
    example:
      'Client confirmed partial receipt acceptable for this transaction.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
