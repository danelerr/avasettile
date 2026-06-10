import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

  @ApiPropertyOptional({ default: 100, maximum: 1000, description: 'Max records to return.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({ default: 0, description: 'Number of records to skip.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
