import { parseUnits } from 'viem';

export function parseAtomicAmount(amount: string, decimals: number): bigint {
  const parsed = parseUnits(amount, decimals);
  if (parsed <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }
  return parsed;
}
