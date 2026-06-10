import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { ClientStatus } from '../client.types';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Fintech LATAM SA' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    enum: ['active', 'disabled'],
    description: 'Disabled clients are rejected on every API call.',
  })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: ClientStatus;

  @ApiPropertyOptional({
    description: 'Webhook endpoint. Send null to remove it.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_tld: false })
  webhookUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Webhook signing secret. Send null to remove it.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  webhookSecret?: string | null;

  @ApiPropertyOptional({
    description: 'Free-form metadata (replaces existing).',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
