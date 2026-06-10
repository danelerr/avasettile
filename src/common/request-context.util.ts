import { RequestContext } from '../payouts/payout.types';

export function extractRequestContext(
  headers: Record<string, string | string[] | undefined>,
  sourceIp: string,
  actor?: string | null,
): RequestContext {
  return {
    institutionId: firstHeader(headers['x-institution-id']),
    correlationId: firstHeader(headers['x-correlation-id']),
    idempotencyKey: firstHeader(headers['idempotency-key']),
    actor: actor !== undefined ? actor : null,
    sourceIp,
  };
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
