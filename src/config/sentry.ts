import * as Sentry from '@sentry/node';
import { env, features, isProduction } from './env.js';
import { logger } from './logger.js';

/**
 * Initialize Sentry for error tracking
 * Call this early in server startup
 */
export const initSentry = (): void => {
    if (!features.sentry) {
        logger.info('Sentry: Disabled (no SENTRY_DSN configured)');
        return;
    }

    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,

        // Performance monitoring
        tracesSampleRate: isProduction ? 0.1 : 1.0,

        // Release tracking (set via CI/CD)
        release: process.env.npm_package_version,

        // Filter sensitive data
        beforeSend(event) {
            // Remove sensitive data from breadcrumbs
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
                    // Remove authorization headers
                    if (breadcrumb.data?.headers?.authorization) {
                        breadcrumb.data.headers.authorization = '[REDACTED]';
                    }
                    return breadcrumb;
                });
            }

            // Remove user PII in production
            if (isProduction && event.user) {
                delete event.user.email;
                delete event.user.ip_address;
            }

            return event;
        },

        // Ignore common non-actionable errors
        ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'Network request failed',
            'Failed to fetch',
        ],
    });

    logger.info(`Sentry: Initialized (${env.NODE_ENV})`);
};

/**
 * Capture an exception to Sentry with context
 */
export const captureException = (
    error: Error,
    context?: {
        userId?: string;
        requestId?: string;
        extra?: Record<string, unknown>;
    }
): string | undefined => {
    if (!features.sentry) {
        return undefined;
    }

    return Sentry.captureException(error, {
        user: context?.userId ? { id: context.userId } : undefined,
        tags: {
            requestId: context?.requestId,
        },
        extra: context?.extra,
    });
};

/**
 * Set user context for Sentry
 */
export const setSentryUser = (user: { id: string; role?: string }): void => {
    if (!features.sentry) return;
    Sentry.setUser({ id: user.id, role: user.role });
};

/**
 * Clear user context (on logout)
 */
export const clearSentryUser = (): void => {
    if (!features.sentry) return;
    Sentry.setUser(null);
};

/**
 * Capture message to Sentry
 */
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info'): void => {
    if (!features.sentry) return;
    Sentry.captureMessage(message, level);
};

export { Sentry };

