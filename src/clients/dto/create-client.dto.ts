import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({
    description: 'Human-readable client (institution) name.',
    example: 'Fintech LATAM SA',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'HTTPS endpoint that receives signed webhook events.',
    example: 'https://api.fintech-latam.example/avasettle/webhooks',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @ApiPropertyOptional({
    description:
      'HMAC-SHA256 secret used to sign webhook payloads for this client.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'Free-form metadata.' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
