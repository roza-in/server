import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { ConflictError } from '../common/errors/index.js';

/**
 * Idempotency Middleware - Prevents duplicate processing of state-changing requests
 * Uses Redis to store request signatures and cached responses
 */
export const idempotencyMiddleware = (options: {
    ttlSeconds?: number;
    strict?: boolean;
} = {}) => {
    const { ttlSeconds = 86400, strict = false } = options; // Default 24h TTL

    return async (req: Request, res: Response, next: NextFunction) => {
        // Only apply to state-changing methods
        if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
            return next();
        }

        const idempotencyKey = req.headers['x-idempotency-key'] as string;

        if (!idempotencyKey) {
            if (strict) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_IDEMPOTENCY_KEY',
                        message: 'X-Idempotency-Key header is required for this endpoint'
                    }
                });
            }
            return next();
        }

        const redis = getRedisClient();
        if (!redis) {
            logger.warn('Redis unavailable, skipping idempotency check');
            return next();
        }

        const userId = (req as any).user?.userId || 'anonymous';
        const requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(req.body || {}))
            .digest('hex');

        const cacheKey = `idempotency:${userId}:${idempotencyKey}:${req.method}:${req.originalUrl}:${requestHash}`;

        try {
            // 1. Check if key exists
            const existing = await redis.get(cacheKey) as any;

            if (existing) {
                if (existing.status === 'processing') {
                    throw new ConflictError('A request with this idempotency key is already being processed');
                }

                if (existing.status === 'completed') {
                    logger.info(`Idempotency hit: ${cacheKey}`);
                    return res.status(existing.statusCode).json(existing.response);
                }
            }

            // 2. Mark as processing
            await redis.setex(cacheKey, 60, JSON.stringify({ status: 'processing', timestamp: Date.now() }));

            // 3. Wrap response methods to capture and cache the result
            const originalJson = res.json;

            res.json = function (body: any) {
                // Only cache successful or client-error responses, avoid caching server errors if retryable
                if (res.statusCode < 500) {
                    redis.setex(cacheKey, ttlSeconds, JSON.stringify({
                        status: 'completed',
                        statusCode: res.statusCode,
                        response: body,
                        timestamp: Date.now()
                    })).catch(err => logger.error('Failed to cache idempotency response', err));
                } else {
                    // Cleanup processing flag on server error so it can be retried
                    redis.del(cacheKey).catch(err => logger.error('Failed to clear idempotency key', err));
                }

                return originalJson.call(this, body);
            };

            next();
        } catch (error) {
            next(error);
        }
    };
};
