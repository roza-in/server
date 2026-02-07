import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../common/errors/ApiError.js';
import { checkRateLimit } from '../config/redis.js';
import { features } from '../config/env.js';

// In-memory fallback store (used when Redis is unavailable)
const memoryStores = new Map<string, { count: number; reset: number }>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  prefix?: string;
}

/**
 * Rate limiting middleware with Upstash Redis support
 * Falls back to in-memory if Redis unavailable
 */
export const rateLimit = (options: RateLimitOptions | number = 60000, maxRequests = 100, message = 'Too many requests, please try again later') => {
  const windowMs = typeof options === 'number' ? options : options.windowMs || 60000;
  const max = typeof options === 'number' ? maxRequests : options.max || 100;
  const msg = typeof options === 'number' ? message : options.message || 'Too many requests, please try again later';
  const prefix = typeof options === 'number' ? '' : options.prefix || '';

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || 'unknown';
    const key = `${prefix}:${identifier}:${req.path}`;

    try {
      let allowed: boolean;
      let remaining: number;
      let resetAt: Date;

      // Use Redis if available, otherwise fallback to memory
      if (features.upstashRedis) {
        const result = await checkRateLimit(key, max, windowMs);
        allowed = result.allowed;
        remaining = result.remaining;
        resetAt = result.resetAt;
      } else {
        // In-memory fallback
        const now = Date.now();
        let record = memoryStores.get(key);

        if (!record || now > record.reset) {
          record = { count: 0, reset: now + windowMs };
        }

        record.count++;
        memoryStores.set(key, record);

        allowed = record.count <= max;
        remaining = Math.max(0, max - record.count);
        resetAt = new Date(record.reset);
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetAt.toISOString());

      if (!allowed) {
        throw new ApiError(msg, 429, 'TOO_MANY_REQUESTS');
      }

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else {
        // On any Redis error, fail open (allow request)
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
