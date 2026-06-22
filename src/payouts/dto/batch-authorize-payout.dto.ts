import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';
import { AuthorizePayoutDto } from './authorize-payout.dto';

export class BatchAuthorizePayoutDto extends AuthorizePayoutDto {
  @ApiProperty({
    type: [String],
    example: [
      '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177',
      '8c5e0a5e-85b9-4f31-a2c8-c9ee4bf57288',
    ],
    description:
      'Prepared payout ids to authorize and settle atomically in one SettlementVault batch. All must share the same asset. Max 256 (the vault batch cap).',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(256)
  @IsString({ each: true })
  payoutIds!: string[];
}
