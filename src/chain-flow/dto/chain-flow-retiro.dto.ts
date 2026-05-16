import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEthereumAddress,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class ChainFlowRetiroDto {
  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  idRetiro?: string;

  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  id_retiro?: string;

  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ example: '25.50' })
  @IsOptional()
  @IsString()
  monto?: string;

  @ApiPropertyOptional({ example: '25.50' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'USDC' })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({ example: 'USDC' })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsOptional()
  @IsEthereumAddress()
  wallet?: `0x${string}`;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsOptional()
  @IsEthereumAddress()
  direccionDestino?: `0x${string}`;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
  })
  @IsOptional()
  @IsEthereumAddress()
  beneficiaryAddress?: `0x${string}`;

  @ApiPropertyOptional({ example: 'Cliente LATAM' })
  @IsOptional()
  @IsString()
  beneficiario?: string;

  @ApiPropertyOptional({ example: { country: 'BO' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ChainFlowEstadoRetiroDto {
  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  idRetiro?: string;

  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  id_retiro?: string;

  @ApiPropertyOptional({ example: 'cf-retiro-0001' })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ example: '7b4d9f4d-74a8-4e20-91b7-b8dd3af46177' })
  @IsOptional()
  @IsString()
  payoutId?: string;
}
