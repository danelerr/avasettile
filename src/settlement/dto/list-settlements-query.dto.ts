import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SettlementStatus } from '../settlement.types';

export class ListSettlementsQueryDto {
  @ApiPropertyOptional({
    enum: SettlementStatus,
    example: SettlementStatus.Pending,
  })
  @IsOptional()
  @IsIn(Object.values(SettlementStatus))
  status?: SettlementStatus;
}
