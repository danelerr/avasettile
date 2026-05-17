import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsEthereumAddress,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

type ChainFlowNumeric = number | string;

export class ChainFlowRetiroDto {
  @ApiPropertyOptional({
    example: 'EXT-0001',
    description:
      'Chain Flow external transaction id. Preferred idempotency key for AvaSettle.',
  })
  @IsOptional()
  @IsString()
  tcTransaccionExterna?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Chain Flow payout amount. Numbers are normalized to strings.',
  })
  @IsOptional()
  @Allow()
  tnMonto?: ChainFlowNumeric;

  @ApiPropertyOptional({
    example: 1,
    description: 'Chain Flow currency code. 1 maps to USDC and 2 maps to USDT.',
  })
  @IsOptional()
  @Allow()
  tnMoneda?: ChainFlowNumeric;

  @ApiPropertyOptional({
    example: '0x1111111111111111111111111111111111111111',
    description: 'Chain Flow destination EVM address.',
  })
  @IsOptional()
  @IsEthereumAddress()
  tcCuentaDestino?: `0x${string}`;

  @ApiPropertyOptional({
    example: 12345,
    description: 'Chain Flow withdrawal/payment id.',
  })
  @IsOptional()
  @Allow()
  tnRetiroPago?: ChainFlowNumeric;

  @ApiPropertyOptional({
    example: 9001,
    description: 'Chain Flow block/transfer reference id.',
  })
  @IsOptional()
  @Allow()
  tnTransferenciaBloque?: ChainFlowNumeric;

  @ApiPropertyOptional({
    example: 3,
    description: 'Chain Flow payment processor id.',
  })
  @IsOptional()
  @Allow()
  tnProcesadorPagos?: ChainFlowNumeric;

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
  @ApiPropertyOptional({ example: 'EXT-0001' })
  @IsOptional()
  @IsString()
  tcTransaccionExterna?: string;

  @ApiPropertyOptional({ example: 12345 })
  @IsOptional()
  @Allow()
  tnRetiroPago?: ChainFlowNumeric;

  @ApiPropertyOptional({ example: 9001 })
  @IsOptional()
  @Allow()
  tnTransferenciaBloque?: ChainFlowNumeric;

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
