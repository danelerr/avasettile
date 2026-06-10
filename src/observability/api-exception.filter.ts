import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { currentTrace } from './trace-context';

type HttpExceptionLike = { getStatus(): number; getResponse(): unknown };

function isHttpException(e: unknown): e is HttpExceptionLike {
  return typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>)['getStatus'] === 'function';
}

/**
 * Global exception filter. Logs ApiExceptionLog for every unhandled exception
 * and returns the appropriate HTTP response.
 *
 * Schema:
 *   traceId, spanId, requestIDInternal, requestID, outDate, method, source, exceptionValue
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { traceId, spanId, requestID, requestIDInternal } = currentTrace();

    const status = isHttpException(exception)
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let exceptionValue: string;
    if (isHttpException(exception)) {
      try {
        exceptionValue = JSON.stringify(exception.getResponse());
      } catch {
        exceptionValue = String(exception);
      }
    } else if (exception instanceof Error) {
      exceptionValue = exception.message;
    } else {
      exceptionValue = String(exception);
    }

    const entry = {
      traceId,
      spanId,
      requestIDInternal,
      requestID,
      outDate: new Date().toISOString(),
      method: req.method,
      source: `${req.method} ${req.path}`,
      exceptionValue,
    };

    if (status >= 500) {
      this.logger.error(JSON.stringify(entry));
      if (exception instanceof Error && exception.stack) {
        this.logger.error(exception.stack);
      }
    } else {
      this.logger.warn(JSON.stringify(entry));
    }

    if (!res.headersSent) {
      res.status(status).json(
        isHttpException(exception)
          ? exception.getResponse()
          : { statusCode: status, message: 'Internal server error' },
      );
    }
  }
}
