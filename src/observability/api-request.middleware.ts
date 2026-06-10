import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { sanitizeJson, sanitizeQueryString } from './data-sanitizer';
import { currentTrace } from './trace-context';

/**
 * Logs ApiRequestLog for every incoming HTTP request.
 * Must run AFTER TraceMiddleware so currentTrace() is populated.
 *
 * Schema:
 *   traceId, spanId, requestIDInternal, requestID, method, path, status,
 *   inDate, outDate, user, headers, queryParameters, request, response, remoteAddress
 */
@Injectable()
export class ApiRequestMiddleware implements NestMiddleware {
  private readonly logger = new Logger('ApiRequest');

  use(req: Request, res: Response, next: NextFunction): void {
    const inDate = new Date().toISOString();
    // Capture trace synchronously while context is guaranteed active
    const { traceId, spanId, requestID, requestIDInternal } = currentTrace();

    const method = req.method;
    const path = req.path;
    const remoteAddress = (req.ip ?? req.socket?.remoteAddress ?? '').replace(
      /^::ffff:/,
      '',
    );

    // Format: [key:value][key:value]... (midd-library header format)
    const headers = Object.entries(req.headers)
      .map(
        ([k, v]) =>
          `[${k}:${Array.isArray(v) ? v.join(',') : String(v ?? '')}]`,
      )
      .join('');

    const queryParameters =
      req.query && Object.keys(req.query).length
        ? JSON.stringify(req.query)
        : undefined;

    let requestBody: string | undefined;
    if (
      req.body &&
      typeof req.body === 'object' &&
      Object.keys(req.body as object).length
    ) {
      try {
        requestBody = JSON.stringify(
          sanitizeJson(req.body as Record<string, unknown>),
        );
      } catch {
        /* non-JSON body */
      }
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      requestBody = sanitizeQueryString(req.body);
    }

    // Intercept res.json to capture the sanitized response body before it's sent
    let responseBody: string | undefined;
    const originalJson = res.json.bind(res) as (body: unknown) => Response;
    res.json = (body: unknown): Response => {
      try {
        if (body !== null && body !== undefined) {
          responseBody = JSON.stringify(sanitizeJson(body));
        }
      } catch {
        /* ignore capture errors */
      }
      return originalJson(body);
    };

    res.on('finish', () => {
      const outDate = new Date().toISOString();
      const { statusCode } = res;
      const level: 'error' | 'warn' | 'log' =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';

      // Authenticated user identity if set by auth guard
      const user =
        (req as Request & { user?: { id?: string; sub?: string } }).user?.id ??
        (req as Request & { user?: { id?: string; sub?: string } }).user?.sub ??
        undefined;

      const entry: Record<string, unknown> = {
        traceId,
        spanId,
        requestIDInternal,
        requestID,
        method,
        path,
        status: statusCode,
        inDate,
        outDate,
        ...(user !== undefined && { user }),
        headers,
        ...(queryParameters !== undefined && { queryParameters }),
        ...(requestBody !== undefined && { request: requestBody }),
        ...(responseBody !== undefined && { response: responseBody }),
        remoteAddress,
      };

      this.logger[level](JSON.stringify(entry));
    });

    next();
  }
}
