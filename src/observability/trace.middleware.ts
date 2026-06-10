import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { parseTraceparent, traceStore } from './trace-context';

/**
 * Runs first in the middleware chain.
 * - Reads or generates X-Request-ID (requestID)
 * - Generates requestIDInternal (always local)
 * - Reads W3C traceparent header for traceId/spanId if present, otherwise generates them
 * - Injects X-Request-ID into the response
 * - Wraps the entire request lifecycle in AsyncLocalStorage context
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = (req.headers['x-request-id'] as string | undefined)?.trim();
    const requestID = incomingRequestId || randomUUID();
    const requestIDInternal = randomUUID();

    const traceparent = req.headers['traceparent'] as string | undefined;
    const parsed = traceparent ? parseTraceparent(traceparent) : null;
    const traceId = parsed?.traceId ?? randomBytes(16).toString('hex');
    const spanId = parsed?.spanId ?? randomBytes(8).toString('hex');

    res.setHeader('x-request-id', requestID);

    traceStore.run(
      { traceId, spanId, requestID, requestIDInternal, outboundCallCounter: 0 },
      () => next(),
    );
  }
}
