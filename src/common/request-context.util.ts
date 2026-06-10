import { AuthenticatedRequest } from '../auth/client-api-key.guard';
import { RequestContext } from '../payouts/payout.types';

/**
 * Builds the per-request context from the authenticated request: the client
 * resolved by ClientApiKeyGuard plus tracing/idempotency headers.
 */
export function extractRequestContext(
  request: AuthenticatedRequest,
  actor?: string | null,
): RequestContext {
  const client = request.avasettleClient ?? null;
  return {
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    correlationId: firstHeader(request.headers['x-correlation-id']),
    idempotencyKey: firstHeader(request.headers['idempotency-key']),
    actor: actor !== undefined ? actor : null,
    sourceIp: request.ip ?? null,
  };
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
