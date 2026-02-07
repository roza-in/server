import { logger } from './logger.js';
import { features } from './env.js';
import { getRedisClient } from './redis.js';

const log = logger.child('CircuitBreaker');

/**
 * Circuit Breaker States
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
    name: string;                    // Service name (e.g., 'razorpay', 'sendgrid')
    failureThreshold?: number;       // Number of failures before opening (default: 5)
    successThreshold?: number;       // Successes in half-open before closing (default: 2)
    timeout?: number;                // Time in ms before trying again (default: 30000)
    monitoringWindow?: number;       // Time window for counting failures (default: 60000)
}

/**
 * Circuit Breaker Stats
 */
interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    openedAt: number | null;
}

/**
 * In-memory circuit breaker storage (per-service)
 */
const circuits = new Map<string, CircuitStats>();

/**
 * Get or create circuit stats for a service
 */
const getCircuitStats = (name: string): CircuitStats => {
    if (!circuits.has(name)) {
        circuits.set(name, {
            state: 'CLOSED',
            failures: 0,
            successes: 0,
            lastFailureTime: null,
            lastSuccessTime: null,
            openedAt: null,
        });
    }
    return circuits.get(name)!;
};

/**
 * Circuit Breaker Implementation
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Requests fail fast, circuit is tripped
 * - HALF_OPEN: Testing if service recovered
 */
export class CircuitBreaker {
    private name: string;
    private failureThreshold: number;
    private successThreshold: number;
    private timeout: number;
    private monitoringWindow: number;

    constructor(config: CircuitBreakerConfig) {
        this.name = config.name;
        this.failureThreshold = config.failureThreshold ?? 5;
        this.successThreshold = config.successThreshold ?? 2;
        this.timeout = config.timeout ?? 30000;
        this.monitoringWindow = config.monitoringWindow ?? 60000;
    }

    /**
     * Get current circuit state
     */
    private getStats(): CircuitStats {
        return getCircuitStats(this.name);
    }

    /**
     * Check if circuit should transition from OPEN to HALF_OPEN
     */
    private shouldAttemptReset(): boolean {
        const stats = this.getStats();
        if (stats.state !== 'OPEN' || !stats.openedAt) return false;
        return Date.now() - stats.openedAt >= this.timeout;
    }

    /**
     * Record a successful call
     */
    private recordSuccess(): void {
        const stats = this.getStats();
        stats.successes++;
        stats.lastSuccessTime = Date.now();

        if (stats.state === 'HALF_OPEN' && stats.successes >= this.successThreshold) {
            log.info(`Circuit ${this.name}: HALF_OPEN -> CLOSED (service recovered)`);
            stats.state = 'CLOSED';
            stats.failures = 0;
            stats.successes = 0;
            stats.openedAt = null;
        }
    }

    /**
     * Record a failed call
     */
    private recordFailure(error: Error): void {
        const stats = this.getStats();
        const now = Date.now();

        // Reset failure count if outside monitoring window
        if (stats.lastFailureTime && now - stats.lastFailureTime > this.monitoringWindow) {
            stats.failures = 0;
        }

        stats.failures++;
        stats.lastFailureTime = now;

        if (stats.state === 'HALF_OPEN') {
            // Single failure in half-open trips back to open
            log.warn(`Circuit ${this.name}: HALF_OPEN -> OPEN (test request failed)`);
            stats.state = 'OPEN';
            stats.openedAt = now;
            stats.successes = 0;
        } else if (stats.state === 'CLOSED' && stats.failures >= this.failureThreshold) {
            log.warn(`Circuit ${this.name}: CLOSED -> OPEN (failure threshold reached: ${stats.failures})`);
            stats.state = 'OPEN';
            stats.openedAt = now;
            stats.successes = 0;
        }
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const stats = this.getStats();

        // Check if we should transition from OPEN to HALF_OPEN
        if (this.shouldAttemptReset()) {
            log.info(`Circuit ${this.name}: OPEN -> HALF_OPEN (attempting recovery)`);
            stats.state = 'HALF_OPEN';
            stats.successes = 0;
        }

        // Fail fast if circuit is OPEN
        if (stats.state === 'OPEN') {
            const remainingTime = Math.max(0, this.timeout - (Date.now() - (stats.openedAt || 0)));
            log.debug(`Circuit ${this.name}: OPEN - failing fast (retry in ${Math.round(remainingTime / 1000)}s)`);
            throw new CircuitOpenError(
                `Service ${this.name} is temporarily unavailable. Please try again later.`,
                remainingTime
            );
        }

        // Execute the function
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Get circuit breaker status (for health checks)
     */
    getStatus(): { state: CircuitState; failures: number; healthy: boolean } {
        const stats = this.getStats();
        return {
            state: stats.state,
            failures: stats.failures,
            healthy: stats.state === 'CLOSED',
        };
    }

    /**
     * Manually reset the circuit (for admin/testing)
     */
    reset(): void {
        const stats = this.getStats();
        log.info(`Circuit ${this.name}: Manual reset`);
        stats.state = 'CLOSED';
        stats.failures = 0;
        stats.successes = 0;
        stats.openedAt = null;
    }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
    public readonly retryAfterMs: number;

    constructor(message: string, retryAfterMs: number) {
        super(message);
        this.name = 'CircuitOpenError';
        this.retryAfterMs = retryAfterMs;
    }
}

/**
 * Pre-configured circuit breakers for external services
 */
export const circuitBreakers = {
    razorpay: new CircuitBreaker({
        name: 'razorpay',
        failureThreshold: 5,
        timeout: 30000,  // 30 seconds
    }),
    phonepe: new CircuitBreaker({
        name: 'phonepe',
        failureThreshold: 5,
        timeout: 30000,
    }),
    sendgrid: new CircuitBreaker({
        name: 'sendgrid',
        failureThreshold: 3,
        timeout: 60000,  // 1 minute (email can wait)
    }),
    msg91: new CircuitBreaker({
        name: 'msg91',
        failureThreshold: 5,
        timeout: 30000,
    }),
    whatsapp: new CircuitBreaker({
        name: 'whatsapp',
        failureThreshold: 5,
        timeout: 30000,
    }),
};

/**
 * Get all circuit breaker statuses (for health endpoint)
 */
export const getCircuitBreakerStatuses = (): Record<string, ReturnType<CircuitBreaker['getStatus']>> => {
    return {
        razorpay: circuitBreakers.razorpay.getStatus(),
        phonepe: circuitBreakers.phonepe.getStatus(),
        sendgrid: circuitBreakers.sendgrid.getStatus(),
        msg91: circuitBreakers.msg91.getStatus(),
        whatsapp: circuitBreakers.whatsapp.getStatus(),
    };
};
