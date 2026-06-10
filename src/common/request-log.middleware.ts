import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startMs = Date.now();
    const { method, originalUrl, ip } = req;

    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? null;
    const institutionId =
      (req.headers['x-institution-id'] as string | undefined) ?? null;
    const clientIp = ip?.replace(/^::ffff:/, '') ?? null;

    res.on('finish', () => {
      const durationMs = Date.now() - startMs;
      const { statusCode } = res;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';

      const entry = {
        method,
        path: originalUrl,
        statusCode,
        durationMs,
        ip: clientIp,
        correlationId,
        institutionId,
      };

      this.logger[level](JSON.stringify(entry));
    });

    next();
  }
}
