import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import { isProduction } from './env.js';
import { getRedisClient } from './redis.js';

const log = logger.child('Metrics');

// ============================================================================
// SC2: Instance-aware metrics with Redis-backed global counters
// ============================================================================

const INSTANCE_ID = process.env.HOSTNAME || `pid-${process.pid}`;

/**
 * In-memory metrics storage — per-instance route-level stats.
 * Global counters (totalRequests, totalErrors) are also persisted to Redis
 * so they survive restarts and can be aggregated across instances.
 */
interface RouteMetrics {
    count: number;
    totalMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    errors: number;
    lastUpdated: number;
    responseTimes: number[];
}

interface GlobalMetrics {
    startTime: number;
    totalRequests: number;
    totalErrors: number;
    statusCodes: Record<string, number>;
    routes: Map<string, RouteMetrics>;
    lastMinuteRequests: number[];
}

// Global metrics instance
const metrics: GlobalMetrics = {
    startTime: Date.now(),
    totalRequests: 0,
    totalErrors: 0,
    statusCodes: {},
    routes: new Map(),
    lastMinuteRequests: [],
};

// Configuration
const CONFIG = {
    MAX_RESPONSE_TIMES: 100, // Keep last 100 for percentile calculation
    CLEANUP_INTERVAL_MS: 60000, // 1 minute
    REQUEST_WINDOW_MS: 60000, // 1 minute for throughput calculation
};

/**
 * Calculate percentile from sorted array
 */
const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
};

/**
 * Get or create route metrics
 */
const getRouteMetrics = (routeKey: string): RouteMetrics => {
    if (!metrics.routes.has(routeKey)) {
        metrics.routes.set(routeKey, {
            count: 0,
            totalMs: 0,
            minMs: Infinity,
            maxMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            errors: 0,
            lastUpdated: Date.now(),
            responseTimes: [],
        });
    }
    return metrics.routes.get(routeKey)!;
};

/**
 * Record request metrics (in-memory + async Redis increment)
 */
const recordRequest = (routeKey: string, durationMs: number, statusCode: number): void => {
    // Global metrics (in-memory)
    metrics.totalRequests++;
    metrics.lastMinuteRequests.push(Date.now());
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;

    if (statusCode >= 400) {
        metrics.totalErrors++;
    }

    // Route-specific metrics
    const routeMetrics = getRouteMetrics(routeKey);
    routeMetrics.count++;
    routeMetrics.totalMs += durationMs;
    routeMetrics.minMs = Math.min(routeMetrics.minMs, durationMs);
    routeMetrics.maxMs = Math.max(routeMetrics.maxMs, durationMs);
    routeMetrics.lastUpdated = Date.now();

    if (statusCode >= 400) {
        routeMetrics.errors++;
    }

    // Store response time for percentile calculation
    routeMetrics.responseTimes.push(durationMs);
    if (routeMetrics.responseTimes.length > CONFIG.MAX_RESPONSE_TIMES) {
        routeMetrics.responseTimes.shift();
    }

    // Calculate percentiles
    routeMetrics.p50Ms = percentile(routeMetrics.responseTimes, 50);
    routeMetrics.p95Ms = percentile(routeMetrics.responseTimes, 95);
    routeMetrics.p99Ms = percentile(routeMetrics.responseTimes, 99);

    // SC2: Async Redis counter increment (fire-and-forget, never blocks request)
    incrementRedisCounters(statusCode).catch(() => { /* swallow — Redis optional */ });
};

/**
 * Clean up old request timestamps for throughput calculation
 */
const cleanupOldTimestamps = (): void => {
    const cutoff = Date.now() - CONFIG.REQUEST_WINDOW_MS;
    metrics.lastMinuteRequests = metrics.lastMinuteRequests.filter(ts => ts > cutoff);
};

// Run cleanup periodically
setInterval(cleanupOldTimestamps, CONFIG.CLEANUP_INTERVAL_MS);

/**
 * Normalize route path for grouping similar routes
 * e.g., /api/v1/users/123 -> /api/v1/users/:id
 */
const normalizeRoute = (path: string): string => {
    return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
        .replace(/\/\d+/g, '/:id');
};

/**
 * Performance Metrics Middleware
 * Tracks response times and request counts per route
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Skip health check and static assets
    if (req.path === '/health' || req.path.startsWith('/static')) {
        return next();
    }

    const startTime = Date.now();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
        const duration = Date.now() - startTime;
        const routeKey = `${req.method} ${normalizeRoute(req.path)}`;

        recordRequest(routeKey, duration, res.statusCode);

        // Log slow requests in production
        if (isProduction && duration > 1000) {
            log.warn(`Slow request: ${routeKey}`, {
                duration_ms: duration,
                status: res.statusCode,
                requestId: req.requestId,
            });
        }

        return originalEnd.apply(this, args as any);
    };

    next();
};

/**
 * Get current metrics summary
 */
export const getMetricsSummary = () => {
    cleanupOldTimestamps();

    const uptime = Date.now() - metrics.startTime;
    const throughput = metrics.lastMinuteRequests.length;

    // Get top routes by request count
    const topRoutes = Array.from(metrics.routes.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([route, stats]) => ({
            route,
            count: stats.count,
            avgMs: Math.round(stats.totalMs / stats.count),
            minMs: stats.minMs === Infinity ? 0 : stats.minMs,
            maxMs: stats.maxMs,
            p50Ms: stats.p50Ms,
            p95Ms: stats.p95Ms,
            p99Ms: stats.p99Ms,
            errorRate: stats.count > 0 ? (stats.errors / stats.count * 100).toFixed(2) + '%' : '0%',
        }));

    // Get slowest routes by p95
    const slowestRoutes = Array.from(metrics.routes.entries())
        .filter(([_, stats]) => stats.count >= 10) // Min 10 requests
        .sort((a, b) => b[1].p95Ms - a[1].p95Ms)
        .slice(0, 5)
        .map(([route, stats]) => ({
            route,
            p95Ms: stats.p95Ms,
            count: stats.count,
        }));

    return {
        uptime: {
            seconds: Math.floor(uptime / 1000),
            formatted: formatUptime(uptime),
        },
        requests: {
            total: metrics.totalRequests,
            throughput: `${throughput} req/min`,
            errors: metrics.totalErrors,
            errorRate: metrics.totalRequests > 0
                ? (metrics.totalErrors / metrics.totalRequests * 100).toFixed(2) + '%'
                : '0%',
        },
        statusCodes: metrics.statusCodes,
        topRoutes,
        slowestRoutes,
    };
};

/**
 * Get detailed route metrics
 */
export const getRouteMetricsDetail = (route?: string) => {
    if (route) {
        const stats = metrics.routes.get(route);
        if (!stats) return null;
        return {
            route,
            count: stats.count,
            avgMs: Math.round(stats.totalMs / stats.count),
            minMs: stats.minMs === Infinity ? 0 : stats.minMs,
            maxMs: stats.maxMs,
            p50Ms: stats.p50Ms,
            p95Ms: stats.p95Ms,
            p99Ms: stats.p99Ms,
            errors: stats.errors,
            lastUpdated: new Date(stats.lastUpdated).toISOString(),
        };
    }

    return Array.from(metrics.routes.entries()).map(([route, stats]) => ({
        route,
        count: stats.count,
        avgMs: Math.round(stats.totalMs / stats.count),
        p95Ms: stats.p95Ms,
        errors: stats.errors,
    }));
};

/**
 * Reset metrics (for testing or manual reset)
 */
export const resetMetrics = (): void => {
    metrics.totalRequests = 0;
    metrics.totalErrors = 0;
    metrics.statusCodes = {};
    metrics.routes.clear();
    metrics.lastMinuteRequests = [];
    log.info('Metrics reset');
};

/**
 * Format uptime to human readable
 */
const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};

// ============================================================================
// Metrics Persistence — periodic snapshot to Redis for production monitoring
// ============================================================================

const METRICS_REDIS_KEY = 'metrics:snapshot';
const METRICS_GLOBAL_REQUESTS_KEY = 'metrics:global:totalRequests';
const METRICS_GLOBAL_ERRORS_KEY = 'metrics:global:totalErrors';
const METRICS_STATUS_PREFIX = 'metrics:global:status:';
const METRICS_INSTANCES_KEY = 'metrics:instances';
const METRICS_PERSIST_INTERVAL_MS = 60_000; // Every 60 seconds

/**
 * SC2: Increment Redis-backed global counters (fire-and-forget).
 * These survive restarts and are consistent across all instances.
 */
const incrementRedisCounters = async (statusCode: number): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;

    const pipeline = client.pipeline();
    pipeline.incr(METRICS_GLOBAL_REQUESTS_KEY);
    if (statusCode >= 400) {
        pipeline.incr(METRICS_GLOBAL_ERRORS_KEY);
    }
    pipeline.incr(`${METRICS_STATUS_PREFIX}${statusCode}`);
    // Register this instance in the active instances set (expire 5 min)
    pipeline.sadd(METRICS_INSTANCES_KEY, INSTANCE_ID);
    pipeline.expire(METRICS_INSTANCES_KEY, 300);
    await pipeline.exec();
};

/**
 * Persist current metrics snapshot to Redis (production only).
 * Each instance writes its own snapshot keyed by INSTANCE_ID.
 */
const persistMetricsToRedis = async (): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;

    try {
        const summary = getMetricsSummary();
        const instanceKey = `${METRICS_REDIS_KEY}:${INSTANCE_ID}`;
        await client.setex(instanceKey, 300, JSON.stringify({
            ...summary,
            persistedAt: new Date().toISOString(),
            instanceId: INSTANCE_ID,
        }));
    } catch (error) {
        log.error('Failed to persist metrics to Redis', error);
    }
};

/**
 * SC2: Get aggregated global metrics from Redis (cross-instance totals).
 * Returns null if Redis is unavailable.
 */
export const getAggregatedMetrics = async (): Promise<{
    totalRequests: number;
    totalErrors: number;
    activeInstances: string[];
    statusCodes: Record<string, number>;
} | null> => {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const [totalReqs, totalErrs, instances] = await Promise.all([
            client.get(METRICS_GLOBAL_REQUESTS_KEY),
            client.get(METRICS_GLOBAL_ERRORS_KEY),
            client.smembers(METRICS_INSTANCES_KEY),
        ]);

        // Fetch common status codes
        const statusKeys = ['200', '201', '400', '401', '403', '404', '429', '500'];
        const statusResults = await Promise.all(
            statusKeys.map(code => client.get(`${METRICS_STATUS_PREFIX}${code}`))
        );

        const statusCodes: Record<string, number> = {};
        statusKeys.forEach((code, i) => {
            const val = Number(statusResults[i]) || 0;
            if (val > 0) statusCodes[code] = val;
        });

        return {
            totalRequests: Number(totalReqs) || 0,
            totalErrors: Number(totalErrs) || 0,
            activeInstances: instances,
            statusCodes,
        };
    } catch (error) {
        log.error('Failed to get aggregated metrics from Redis', error);
        return null;
    }
};

let persistTimer: NodeJS.Timeout | null = null;

/** Start periodic metrics persistence (call once in server startup) */
export const startMetricsPersistence = (): void => {
    if (!isProduction) return;
    if (persistTimer) return;

    persistTimer = setInterval(persistMetricsToRedis, METRICS_PERSIST_INTERVAL_MS);
    persistTimer.unref();
    log.info('Metrics persistence started (Redis snapshot every 60s)');
};

/** Stop metrics persistence (call on shutdown) */
export const stopMetricsPersistence = (): void => {
    if (persistTimer) {
        clearInterval(persistTimer);
        persistTimer = null;
    }
};
