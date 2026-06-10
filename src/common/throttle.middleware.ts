import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigurationService } from '../configuration/configuration.service';

type WindowEntry = { count: number; resetAt: number };

@Injectable()
export class ThrottleMiddleware implements NestMiddleware {
  private readonly windows = new Map<string, WindowEntry>();
  private readonly windowMs = 1_000;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private readonly configuration: ConfigurationService) {
    // Prune stale entries every 60 seconds to avoid unbounded memory growth.
    this.cleanupTimer = setInterval(() => this.prune(), 60_000);
    this.cleanupTimer.unref?.();
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const limit = this.configuration.throttleRps;
    if (limit <= 0) return next();

    const key = (req.ip ?? 'unknown').replace(/^::ffff:/, '');
    const now = Date.now();

    let entry = this.windows.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
      return next();
    }

    if (entry.count >= limit) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Slow down.',
        retryAfterMs: entry.resetAt - now,
      });
      return;
    }

    entry.count++;
    next();
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      if (now >= entry.resetAt) this.windows.delete(key);
    }
  }
}
