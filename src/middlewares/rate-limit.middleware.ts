import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../common/errors.js';
import { logger } from '../common/logger.js';
import { RATE_LIMITS } from '../config/constants.js';

/**
 * Simple in-memory rate limiting store
 * For production, use Redis-based rate limiting
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Generate rate limit key based on IP and optional user ID
 */
const getRateLimitKey = (req: Request, prefix: string = 'default'): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.user?.userId || 'anonymous';
  return `${prefix}:${ip}:${userId}`;
};

/**
 * Rate limit middleware factory
 */
export const rateLimit = (options?: {
  windowMs?: number;
  max?: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}) => {
  const windowMs = options?.windowMs ?? RATE_LIMITS.DEFAULT.windowMs;
  const max = options?.max ?? RATE_LIMITS.DEFAULT.max;
  const prefix = options?.prefix ?? 'default';
  const keyGenerator = options?.keyGenerator ?? ((req) => getRateLimitKey(req, prefix));
  const skip = options?.skip;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip rate limiting if configured
      if (skip && skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();

      // Get or create entry
      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetTime < now) {
        // Create new entry
        entry = {
          count: 1,
          resetTime: now + windowMs,
        };
        rateLimitStore.set(key, entry);
      } else {
        // Increment count
        entry.count++;
      }

      // Set rate limit headers
      const remaining = Math.max(0, max - entry.count);
      const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
      res.setHeader('Retry-After', resetSeconds);

      // Check if limit exceeded
      if (entry.count > max) {
        logger.warn(`Rate limit exceeded for ${key}`, {
          ip: req.ip,
          path: req.path,
          count: entry.count,
        });
        throw new TooManyRequestsError(
          `Too many requests. Please try again in ${resetSeconds} seconds.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Pre-configured rate limiters for common use cases
 */

// Default rate limiter (100 requests per minute)
export const defaultRateLimit = rateLimit();

// Auth rate limiter (10 requests per minute)
export const authRateLimit = rateLimit({
  ...RATE_LIMITS.AUTH,
  prefix: 'auth',
});

// OTP rate limiter (3 requests per minute)
export const otpRateLimit = rateLimit({
  ...RATE_LIMITS.OTP,
  prefix: 'otp',
});

// Booking rate limiter (20 requests per minute)
export const bookingRateLimit = rateLimit({
  ...RATE_LIMITS.BOOKING,
  prefix: 'booking',
});

// Strict rate limiter (5 requests per minute) - for sensitive operations
export const strictRateLimit = rateLimit({
  windowMs: 60000,
  max: 5,
  prefix: 'strict',
});

// Admin rate limiter (200 requests per minute)
export const adminRateLimit = rateLimit({
  windowMs: 60000,
  max: 200,
  prefix: 'admin',
  skip: (req) => req.user?.role !== 'admin',
});

/**
 * Per-endpoint rate limiter
 * Creates a unique rate limiter for a specific endpoint
 */
export const endpointRateLimit = (
  endpoint: string,
  windowMs: number,
  max: number
) => {
  return rateLimit({
    windowMs,
    max,
    prefix: `endpoint:${endpoint}`,
  });
};

/**
 * Sliding window rate limiter (more accurate but more memory intensive)
 * For production, implement with Redis
 */
interface SlidingWindowEntry {
  timestamps: number[];
}

const slidingWindowStore = new Map<string, SlidingWindowEntry>();

export const slidingWindowRateLimit = (options?: {
  windowMs?: number;
  max?: number;
  prefix?: string;
}) => {
  const windowMs = options?.windowMs ?? 60000;
  const max = options?.max ?? 100;
  const prefix = options?.prefix ?? 'sliding';

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = getRateLimitKey(req, prefix);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create entry
      let entry = slidingWindowStore.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        slidingWindowStore.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

      // Add current timestamp
      entry.timestamps.push(now);

      // Set headers
      const count = entry.timestamps.length;
      const remaining = Math.max(0, max - count);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      // Check if limit exceeded
      if (count > max) {
        const oldestTimestamp = entry.timestamps[0];
        const retryAfter = Math.ceil(
          ((oldestTimestamp ?? 0) + windowMs - now) / 1000
        );

        res.setHeader('Retry-After', retryAfter);

        throw new TooManyRequestsError(
          `Too many requests. Please try again in ${retryAfter} seconds.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Aliases for route usage
export const rateLimitOTP = otpRateLimit;
export const rateLimitAuth = authRateLimit;
export const rateLimitBooking = bookingRateLimit;

