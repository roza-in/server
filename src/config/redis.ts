import { Redis } from '@upstash/redis';
import { env, features } from './env.js';
import { logger } from './logger.js';

/**
 * Upstash Redis client for serverless-compatible operations
 * Used for rate limiting, caching, and session storage
 */

let redisClient: Redis | null = null;

/**
 * Initialize Upstash Redis client
 */
export const initUpstashRedis = (): Redis | null => {
    if (!features.upstashRedis) {
        logger.info('Upstash Redis: Disabled (no credentials configured)');
        return null;
    }

    try {
        redisClient = new Redis({
            url: env.UPSTASH_REDIS_REST_URL!,
            token: env.UPSTASH_REDIS_REST_TOKEN!,
        });

        logger.info('Upstash Redis: Initialized');
        return redisClient;
    } catch (error) {
        logger.error('Upstash Redis: Failed to initialize', error);
        return null;
    }
};

/**
 * Get the Redis client (initialize if needed)
 */
export const getRedisClient = (): Redis | null => {
    if (!redisClient && features.upstashRedis) {
        return initUpstashRedis();
    }
    return redisClient;
};

/**
 * Rate limiter using Upstash Redis with sliding window
 */
export const checkRateLimit = async (
    key: string,
    maxRequests: number,
    windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> => {
    const client = getRedisClient();

    if (!client) {
        // Fallback: always allow if Redis unavailable
        return { allowed: true, remaining: maxRequests, resetAt: new Date() };
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    const fullKey = `ratelimit:${key}`;

    try {
        // Use a multi-command for atomic operations
        const pipeline = client.pipeline();

        // Remove old entries outside the window
        pipeline.zremrangebyscore(fullKey, 0, windowStart);

        // Add current request
        pipeline.zadd(fullKey, { score: now, member: `${now}:${Math.random()}` });

        // Count requests in window
        pipeline.zcard(fullKey);

        // Set key expiry to cleanup old keys
        pipeline.expire(fullKey, Math.ceil(windowMs / 1000));

        const results = await pipeline.exec();
        const requestCount = results[2] as number;

        const allowed = requestCount <= maxRequests;
        const remaining = Math.max(0, maxRequests - requestCount);
        const resetAt = new Date(now + windowMs);

        return { allowed, remaining, resetAt };
    } catch (error) {
        logger.error('Rate limit check failed', error);
        // Fail open - allow request if Redis fails
        return { allowed: true, remaining: maxRequests, resetAt: new Date() };
    }
};

/**
 * Cache helper - get or set with TTL
 */
export const cacheGetOrSet = async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
): Promise<T> => {
    const client = getRedisClient();

    if (!client) {
        // No cache available, just fetch
        return fetchFn();
    }

    try {
        // Try to get cached value
        const cached = await client.get(key);
        if (cached !== null) {
            return cached as T;
        }

        // Fetch fresh value
        const value = await fetchFn();

        // Cache it
        await client.setex(key, ttlSeconds, JSON.stringify(value));

        return value;
    } catch (error) {
        logger.error('Cache operation failed', error);
        // Fallback to direct fetch
        return fetchFn();
    }
};

/**
 * Invalidate a specific cache key
 */
export const cacheInvalidate = async (key: string): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;
    try {
        await client.del(key);
    } catch (error) {
        logger.error(`Failed to invalidate cache key: ${key}`, error);
    }
};

/**
 * Invalidate multiple cache keys by prefix using SCAN
 * Only works with Upstash REST — falls back to known-key deletion
 */
export const cacheInvalidateByPrefix = async (prefix: string): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;
    try {
        // Upstash REST API supports scan with MATCH
        let cursor = 0;
        const keysToDelete: string[] = [];
        do {
            const [nextCursor, keys] = await client.scan(cursor, { match: `${prefix}*`, count: 100 });
            cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
            keysToDelete.push(...keys);
        } while (cursor !== 0);

        if (keysToDelete.length > 0) {
            const pipeline = client.pipeline();
            for (const key of keysToDelete) {
                pipeline.del(key);
            }
            await pipeline.exec();
        }
    } catch (error) {
        logger.error(`Failed to invalidate cache by prefix: ${prefix}`, error);
    }
};

/** Well-known cache key builders for hot paths */
export const CacheKeys = {
    doctorAvailability: (doctorId: string) => `cache:doctor:availability:${doctorId}`,
    specializations: () => 'cache:specializations:active',
    specializationAll: () => 'cache:specializations:all',
    hospitalProfile: (hospitalId: string) => `cache:hospital:profile:${hospitalId}`,
    hospitalBySlug: (slug: string) => `cache:hospital:slug:${slug}`,
    platformConfig: () => 'cache:platform:config',
    platformConfigKey: (key: string) => `cache:platform:config:${key}`,
} as const;

/** Cache TTLs in seconds */
export const CacheTTL = {
    DOCTOR_AVAILABILITY: 120,  // P1: safe to increase — event-bus invalidation on schedule/appointment changes
    SPECIALIZATIONS: 300,       // 5 minutes
    HOSPITAL_PROFILE: 120,      // 2 minutes
    PLATFORM_CONFIG: 600,       // 10 minutes
} as const;

export { Redis };
