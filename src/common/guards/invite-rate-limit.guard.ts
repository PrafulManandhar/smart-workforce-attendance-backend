import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RateLimitEntry {
  windowStart: number;
  count: number;
}

@Injectable()
export class InviteRateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60_000; // 1 minute
  private static readonly MAX_REQUESTS = 30; // per IP per route per window

  private static readonly store = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const routeKey = `${req.method}:${req.originalUrl ?? req.url}`;

    const key = `${ip}:${routeKey}`;
    const now = Date.now();

    const entry = InviteRateLimitGuard.store.get(key);

    if (!entry || now - entry.windowStart > InviteRateLimitGuard.WINDOW_MS) {
      InviteRateLimitGuard.store.set(key, {
        windowStart: now,
        count: 1,
      });
      return true;
    }

    if (entry.count >= InviteRateLimitGuard.MAX_REQUESTS) {
      throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count += 1;
    return true;
  }
}

