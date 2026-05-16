import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PayInStatus } from '../payins.types';

export class ListPayInsQueryDto {
  @ApiPropertyOptional({
    enum: PayInStatus,
    enumName: 'PayInStatus',
    example: PayInStatus.Pending,
  })
  @IsOptional()
  @IsIn(Object.values(PayInStatus))
  status?: PayInStatus;

  @ApiPropertyOptional({
    example: 'chainflow-payin-0001',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalId?: string;
}
