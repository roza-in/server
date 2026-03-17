import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

const log = logger.child('FeatureFlags');

// ============================================================================
// SC7: Feature Flag Service
//
// Extends the static `features` object in env.ts with dynamic, Redis-backed
// feature flags supporting:
//   - Global on/off toggles
//   - Percentage-based gradual rollouts
//   - Per-user and per-hospital targeting
//   - Fallback to static defaults when Redis is unavailable
//
// Flag evaluation order:
//   1. User allowlist/blocklist (if configured)
//   2. Hospital allowlist (if configured)
//   3. Percentage rollout (if configured, deterministic per userId)
//   4. Global enabled/disabled
// ============================================================================

const FLAGS_HASH_KEY = 'feature:flags';

/** Shape of a feature flag stored in Redis */
export interface FeatureFlag {
    /** Unique flag name (e.g., 'new-booking-flow') */
    name: string;
    /** Global toggle — if false, flag is off for everyone */
    enabled: boolean;
    /** Optional: percentage rollout (0–100). Applied when enabled=true. */
    rolloutPercent?: number;
    /** Optional: always enable for these user IDs */
    allowUsers?: string[];
    /** Optional: always enable for these hospital IDs */
    allowHospitals?: string[];
    /** Optional: always disable for these user IDs */
    blockUsers?: string[];
    /** Description for admin dashboard */
    description?: string;
    /** Last updated timestamp */
    updatedAt?: string;
}

/** Local in-memory cache of flags (ttl-based) */
let flagCache: Map<string, FeatureFlag> = new Map();
let flagCacheLoadedAt = 0;
const FLAG_CACHE_TTL_MS = 30_000; // Refresh from Redis every 30s

/**
 * Load all feature flags from Redis into local cache.
 */
const loadFlags = async (): Promise<void> => {
    const client = getRedisClient();
    if (!client) return;

    try {
        const raw = await client.hgetall(FLAGS_HASH_KEY);
        if (!raw || Object.keys(raw).length === 0) return;

        const newCache = new Map<string, FeatureFlag>();
        for (const [name, value] of Object.entries(raw)) {
            try {
                const flag: FeatureFlag = typeof value === 'string' ? JSON.parse(value) : value as FeatureFlag;
                newCache.set(name, flag);
            } catch {
                log.warn(`Invalid flag data for "${name}", skipping`);
            }
        }

        flagCache = newCache;
        flagCacheLoadedAt = Date.now();
        log.debug(`Loaded ${newCache.size} feature flags from Redis`);
    } catch (error) {
        log.error('Failed to load feature flags from Redis', error);
    }
};

/**
 * Ensure cache is fresh (reload if TTL expired).
 */
const ensureCacheFresh = async (): Promise<void> => {
    if (Date.now() - flagCacheLoadedAt > FLAG_CACHE_TTL_MS) {
        await loadFlags();
    }
};

/**
 * Deterministic hash for percentage rollout.
 * Uses a simple string hash so the same userId always gets the same result.
 */
const hashPercent = (flagName: string, userId: string): number => {
    const str = `${flagName}:${userId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
};

// ============================================================================
// Public API
// ============================================================================

/** Context for evaluating a feature flag */
export interface FlagContext {
    userId?: string;
    hospitalId?: string;
}

/**
 * Check if a feature flag is enabled for a given context.
 *
 * @param flagName - The flag name (e.g., 'new-booking-flow')
 * @param context  - Optional user/hospital context for targeting
 * @param defaultValue - Fallback if flag doesn't exist (default: false)
 * @returns Whether the flag is enabled for this context
 */
export const isFeatureEnabled = async (
    flagName: string,
    context: FlagContext = {},
    defaultValue: boolean = false,
): Promise<boolean> => {
    await ensureCacheFresh();

    const flag = flagCache.get(flagName);
    if (!flag) return defaultValue;

    // Step 1: Check blocklist
    if (context.userId && flag.blockUsers?.includes(context.userId)) {
        return false;
    }

    // Step 2: Check user allowlist
    if (context.userId && flag.allowUsers?.includes(context.userId)) {
        return true;
    }

    // Step 3: Check hospital allowlist
    if (context.hospitalId && flag.allowHospitals?.includes(context.hospitalId)) {
        return true;
    }

    // Step 4: Global toggle
    if (!flag.enabled) return false;

    // Step 5: Percentage rollout
    if (flag.rolloutPercent !== undefined && flag.rolloutPercent < 100) {
        if (!context.userId) return false; // No userId → can't do deterministic rollout
        const bucket = hashPercent(flagName, context.userId);
        return bucket < flag.rolloutPercent;
    }

    // Fully enabled
    return true;
};

/**
 * Set or update a feature flag in Redis.
 */
export const setFeatureFlag = async (flag: FeatureFlag): Promise<boolean> => {
    const client = getRedisClient();
    if (!client) {
        log.warn('Cannot set feature flag — Redis unavailable');
        return false;
    }

    try {
        flag.updatedAt = new Date().toISOString();
        await client.hset(FLAGS_HASH_KEY, { [flag.name]: JSON.stringify(flag) });
        // Update local cache immediately
        flagCache.set(flag.name, flag);
        log.info(`Feature flag "${flag.name}" updated: enabled=${flag.enabled}, rollout=${flag.rolloutPercent ?? 100}%`);
        return true;
    } catch (error) {
        log.error(`Failed to set feature flag "${flag.name}"`, error);
        return false;
    }
};

/**
 * Remove a feature flag from Redis.
 */
export const removeFeatureFlag = async (flagName: string): Promise<boolean> => {
    const client = getRedisClient();
    if (!client) return false;

    try {
        await client.hdel(FLAGS_HASH_KEY, flagName);
        flagCache.delete(flagName);
        log.info(`Feature flag "${flagName}" removed`);
        return true;
    } catch (error) {
        log.error(`Failed to remove feature flag "${flagName}"`, error);
        return false;
    }
};

/**
 * List all feature flags (for admin dashboard).
 */
export const listFeatureFlags = async (): Promise<FeatureFlag[]> => {
    await ensureCacheFresh();
    return Array.from(flagCache.values());
};

/**
 * Pre-warm the flag cache at startup.
 */
export const initFeatureFlags = async (): Promise<void> => {
    await loadFlags();
    log.info(`Feature flags initialized (${flagCache.size} flags loaded)`);
};
