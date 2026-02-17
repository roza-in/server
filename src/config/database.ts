import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { getRedisClient } from './redis.js';
import { features, env } from './env.js';

/**
 * Database & Infrastructure Health Helpers
 *
 * P5 — Connection Pooling Strategy:
 *
 * All database access in this project uses the Supabase JS client which
 * communicates via PostgREST (REST API) and not direct TCP connections.
 * This means connection pooling is managed **server-side by Supabase**:
 *
 *   PostgREST → PgBouncer (connection pooler) → PostgreSQL
 *
 * Key implications:
 * - Each Supabase `.from()` or `.rpc()` call is an HTTP request to PostgREST
 * - PostgREST uses PgBouncer in transaction mode (configurable per Supabase plan)
 * - Free & Pro plans: 60 direct / 200 pooled connections
 * - Team & Enterprise: higher limits
 *
 * If you ever add direct SQL via `pg.Pool` (e.g. for complex migrations
 * or streaming queries), configure it via DATABASE_URL with pooling:
 *
 *   DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres?pgbouncer=true
 *
 * The `:6543` port routes through PgBouncer (vs `:5432` which is direct).
 *
 * Current architecture ensures we stay within pooled connection limits:
 * - Single `supabaseAdmin` client (service role, bypasses RLS)
 * - Per-request `createUserClientFromRequest()` clients (anon key, respects RLS)
 * - Both use HTTP → PostgREST → PgBouncer, so no TCP connection overhead
 */

/**
 * Connection pool limits for monitoring.
 * These match Supabase Pro plan defaults; adjust for your plan tier.
 */
export const DB_POOL_CONFIG = {
    /** Max concurrent direct connections (Supabase plan-dependent) */
    maxDirectConnections: 60,
    /** Max concurrent pooled connections via PgBouncer port 6543 */
    maxPooledConnections: 200,
    /** PostgREST uses transaction-mode pooling by default */
    poolMode: 'transaction' as const,
} as const;
export const db = {
    /**
     * Health Check - Database
     */
    async checkConnection(): Promise<boolean> {
        try {
            const { error } = await supabaseAdmin.from('users').select('id').limit(1);
            if (error && error.code !== 'PGRST116') throw error;
            return true;
        } catch (err) {
            logger.error('Database connection failed', err);
            return false;
        }
    },

    /**
     * Detailed Health Check with latency
     */
    async healthCheck(): Promise<{
        database: { connected: boolean; latencyMs: number };
        redis: { connected: boolean; latencyMs: number } | null;
    }> {
        // Database check with latency
        const dbStart = Date.now();
        let dbConnected = false;
        try {
            const { error } = await supabaseAdmin.from('users').select('id').limit(1);
            if (!error || error.code === 'PGRST116') dbConnected = true;
        } catch (err) {
            logger.error('Database health check failed', err);
        }
        const dbLatency = Date.now() - dbStart;

        // Redis check with latency
        let redisResult = null;
        if (features.upstashRedis) {
            const redisStart = Date.now();
            let redisConnected = false;
            try {
                const client = getRedisClient();
                if (client) {
                    await client.ping();
                    redisConnected = true;
                }
            } catch (err) {
                logger.error('Redis health check failed', err);
            }
            const redisLatency = Date.now() - redisStart;
            redisResult = { connected: redisConnected, latencyMs: redisLatency };
        }

        return {
            database: { connected: dbConnected, latencyMs: dbLatency },
            redis: redisResult,
        };
    },

    /**
     * Raw RPC Helper
     */
    async rpc(fn: string, params?: any) {
        return supabaseAdmin.rpc(fn, params);
    }
};

