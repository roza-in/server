import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { getRedisClient } from './redis.js';
import { features } from './env.js';

/**
 * Database & Infrastructure Health Helpers
 */
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

