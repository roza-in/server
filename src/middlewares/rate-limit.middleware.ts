import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/errors/ApiError.js';
import { checkRateLimit, getRedisClient } from '../config/redis.js';
import { features } from '../config/env.js';
import { logger } from '../config/logger.js';

const log = logger.child('RateLimit');

// ============================================================================
// SC1: In-memory fallback with degraded-mode protection
// ============================================================================

/**
 * In-memory fallback store (used when Redis is unavailable).
 * WARNING: This store is per-instance — in a multi-instance deployment,
 * each instance tracks limits independently. To compensate, we apply a
 * DEGRADED_MODE_FACTOR that reduces the effective max by half so that
 * N instances collectively allow ≈ N × (max/2) instead of N × max.
 */
const memoryStores = new Map<string, { count: number; reset: number }>();

/** Halve allowance per instance when Redis is down (multi-instance safety). */
const DEGRADED_MODE_FACTOR = 0.5;

/** Cleanup expired entries every 60 s to prevent memory leaks. */
const MEMORY_CLEANUP_INTERVAL_MS = 60_000;

let _cleanupTimer: NodeJS.Timeout | null = null;

const ensureCleanupRunning = () => {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    let purged = 0;
    for (const [key, record] of memoryStores) {
      if (now > record.reset) {
        memoryStores.delete(key);
        purged++;
      }
    }
    if (purged > 0) {
      log.debug(`Purged ${purged} expired rate-limit entries (${memoryStores.size} remaining)`);
    }
  }, MEMORY_CLEANUP_INTERVAL_MS);
  _cleanupTimer.unref();
};

/** Track whether we have already logged the degraded-mode warning this window. */
let _degradedWarningLogged = false;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  prefix?: string;
}

/**
 * Rate limiting middleware with Upstash Redis support.
 * Falls back to in-memory with degraded limits if Redis is unavailable.
 */
export const rateLimit = (options: RateLimitOptions | number = 60000, maxRequests = 100, message = 'Too many requests, please try again later') => {
  const windowMs = typeof options === 'number' ? options : options.windowMs || 60000;
  const max = typeof options === 'number' ? maxRequests : options.max || 100;
  const msg = typeof options === 'number' ? message : options.message || 'Too many requests, please try again later';
  const prefix = typeof options === 'number' ? '' : options.prefix || '';

  return async (req: Request, res: Response, next: NextFunction) => {
    // S5: Key on authenticated user ID where available, fall back to IP.
    const authenticatedUserId = (req as any).user?.userId;
    const ipAddr = req.ip || 'unknown';
    const identifier = authenticatedUserId ? `uid:${authenticatedUserId}` : `ip:${ipAddr}`;
    const key = `${prefix}:${identifier}:${req.path}`;

    try {
      let allowed: boolean;
      let remaining: number;
      let resetAt: Date;
      let degraded = false;

      // Attempt Redis first, fall back to memory on failure
      if (features.upstashRedis) {
        try {
          const result = await checkRateLimit(key, max, windowMs);
          allowed = result.allowed;
          remaining = result.remaining;
          resetAt = result.resetAt;
        } catch {
          // Redis call failed at runtime — fall through to in-memory
          degraded = true;
        }
      }

      // In-memory fallback (no Redis configured OR Redis call failed)
      if (!features.upstashRedis || degraded) {
        ensureCleanupRunning();

        if (!_degradedWarningLogged) {
          log.warn('Rate limiting running in DEGRADED MODE (in-memory). Limits are per-instance and halved for safety.');
          _degradedWarningLogged = true;
          // Reset the flag after 5 min so we re-log if still degraded
          setTimeout(() => { _degradedWarningLogged = false; }, 5 * 60 * 1000).unref();
        }

        const degradedMax = Math.max(1, Math.floor(max * DEGRADED_MODE_FACTOR));
        const now = Date.now();
        let record = memoryStores.get(key);

        if (!record || now > record.reset) {
          record = { count: 0, reset: now + windowMs };
        }

        record.count++;
        memoryStores.set(key, record);

        allowed = record.count <= degradedMax;
        remaining = Math.max(0, degradedMax - record.count);
        resetAt = new Date(record.reset);
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining!);
      res.setHeader('X-RateLimit-Reset', resetAt!.toISOString());
      if (degraded) {
        res.setHeader('X-RateLimit-Mode', 'degraded');
      }

      if (!allowed!) {
        throw new ApiError(msg, 429, 'TOO_MANY_REQUESTS');
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        // On unexpected error, fail open (allow request)
        log.error('Rate limit unexpected error — failing open', error);
        next();
      }
    }
  };
};

// Specialized rate limiters
// Relax limits for 'development' AND 'local' environments
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';

export const authLimiter = rateLimit({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: 'Too many login attempts. Please try again later.',
  prefix: 'auth'
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait a minute.',
  prefix: 'otp'
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 100,
  message: 'API rate limit exceeded.',
  prefix: 'api'
});
