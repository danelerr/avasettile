import { Request } from 'express';

/**
 * Reads the API key from x-avasettle-api-key or Authorization: Bearer.
 */
export function extractApiKey(request: Request): string | undefined {
  const header = request.headers['x-avasettle-api-key'];
  const single = Array.isArray(header) ? header[0] : header;
  if (single) return single;

  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return undefined;
  return authorization.slice('Bearer '.length).trim() || undefined;
}
