import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env, isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../common/errors/ApiError.js';

const log = logger.child('WebhookAuth');

/**
 * Webhook API Key Authentication Middleware
 * 
 * Provides an additional layer of security for webhook endpoints beyond
 * provider-specific signature verification (e.g., Razorpay X-Razorpay-Signature).
 * 
 * Supports multiple authentication methods:
 * 1. X-API-Key header (recommended)
 * 2. X-Webhook-Secret header (alternative)
 * 3. Query parameter ?api_key= (for providers that don't support headers)
 */

/**
 * Verify API key using timing-safe comparison
 */
const verifyApiKey = (providedKey: string | undefined, expectedKey: string): boolean => {
    if (!providedKey) return false;

    try {
        const providedBuffer = Buffer.from(providedKey);
        const expectedBuffer = Buffer.from(expectedKey);

        if (providedBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    } catch {
        return false;
    }
};

/**
 * API Key Authentication Middleware for Webhooks
 * 
 * Usage in routes:
 *   router.post('/webhook', webhookApiKeyAuth(), handleWebhook);
 * 
 * Or with options:
 *   router.post('/webhook', webhookApiKeyAuth({ optional: true }), handleWebhook);
 */
export const webhookApiKeyAuth = (options?: { optional?: boolean }) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const webhookApiKey = env.WEBHOOK_API_KEY;

        // If no API key is configured, skip this middleware (allow provider signature only)
        if (!webhookApiKey) {
            if (options?.optional) {
                log.debug('Webhook API key not configured, skipping auth');
                return next();
            }
            log.warn('WEBHOOK_API_KEY not configured - this should be set in production');
            return next();
        }

        // Extract API key from various sources
        const apiKeyFromHeader = req.headers['x-api-key'] as string | undefined;
        const webhookSecretHeader = req.headers['x-webhook-secret'] as string | undefined;
        const apiKeyFromQuery = req.query.api_key as string | undefined;

        const providedKey = apiKeyFromHeader || webhookSecretHeader || apiKeyFromQuery;

        if (!verifyApiKey(providedKey, webhookApiKey)) {
            log.warn('Invalid or missing webhook API key', {
                ip: req.ip,
                path: req.path,
                hasApiKeyHeader: !!apiKeyFromHeader,
                hasSecretHeader: !!webhookSecretHeader,
                hasQueryParam: !!apiKeyFromQuery,
            });

            throw new ApiError('Invalid or missing API key', 401);
        }

        log.debug('Webhook API key verified successfully');
        next();
    };
};

/**
 * Razorpay-specific webhook authentication
 * Combines API key verification + Razorpay signature check
 */
export const razorpayWebhookAuth = (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    // Check if Razorpay signature is present
    if (!signature) {
        log.warn('Missing X-Razorpay-Signature header');
        throw new ApiError('Missing Razorpay signature', 401);
    }

    // SECURITY: Webhook secret is REQUIRED in production
    if (!webhookSecret) {
        if (isProduction) {
            log.error('RAZORPAY_WEBHOOK_SECRET not configured in production - this is a security requirement');
            throw new ApiError('Webhook configuration error', 500);
        }
        log.warn('RAZORPAY_WEBHOOK_SECRET not configured - signature not verified (development only)');
        return next();
    }

    try {
        // Get raw body for signature verification
        // Note: This requires raw body middleware to be configured
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        const expectedBuffer = Buffer.from(expectedSignature);
        const providedBuffer = Buffer.from(signature);

        if (expectedBuffer.length !== providedBuffer.length ||
            !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
            log.warn('Invalid Razorpay webhook signature');
            throw new ApiError('Invalid Razorpay signature', 401);
        }

        log.debug('Razorpay webhook signature verified');
    } catch (error) {
        if (error instanceof ApiError) throw error;
        log.error('Razorpay signature verification error', error);
        throw new ApiError('Signature verification failed', 401);
    }

    next();
};

/**
 * Generic webhook rate limiter (uses the main rate limiter with stricter limits)
 */
// Export rate limiter for use in routes
export { apiLimiter as webhookRateLimit } from './rate-limit.middleware.js';
