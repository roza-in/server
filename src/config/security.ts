import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { checkRateLimit } from './redis.js';
import { features, env } from './env.js';

const log = logger.child('SecurityService');

/**
 * Account lockout configuration
 */
const LOCKOUT_CONFIG = {
    maxFailedAttempts: 5,        // Lock after 5 failed attempts
    lockoutWindowMinutes: 15,    // Check attempts in last 15 minutes
    lockoutDurationMinutes: 30,  // Lock for 30 minutes
};

/**
 * Security service for account protection features
 */
export const securityService = {
    /**
     * Check if an account is locked due to failed login attempts
     * Uses Redis for distributed rate limiting + DB for persistence
     */
    async isAccountLocked(identifier: string): Promise<{ locked: boolean; reason?: string; unlockAt?: Date }> {
        try {
            // Check Redis first (fast path)
            if (features.upstashRedis) {
                const cacheKey = `lockout:${identifier}`;
                const result = await checkRateLimit(cacheKey, 0, LOCKOUT_CONFIG.lockoutDurationMinutes * 60 * 1000);
                if (!result.allowed) {
                    return {
                        locked: true,
                        reason: 'Too many failed login attempts',
                        unlockAt: result.resetAt,
                    };
                }
            }

            // Check DB for failed attempts in the window
            const windowStart = new Date(Date.now() - LOCKOUT_CONFIG.lockoutWindowMinutes * 60 * 1000).toISOString();

            const { data: failedAttempts, error } = await supabaseAdmin
                .from('login_history')
                .select('id, created_at')
                .or(`login_identifier.eq.${identifier},user_id.eq.${identifier}`)
                .eq('success', false)
                .gte('created_at', windowStart)
                .order('created_at', { ascending: false })
                .limit(LOCKOUT_CONFIG.maxFailedAttempts);

            if (error) {
                log.error('Failed to check login history', error);
                return { locked: false }; // Fail open
            }

            if (failedAttempts && failedAttempts.length >= LOCKOUT_CONFIG.maxFailedAttempts) {
                const lastAttempt = new Date(failedAttempts[0].created_at);
                const unlockAt = new Date(lastAttempt.getTime() + LOCKOUT_CONFIG.lockoutDurationMinutes * 60 * 1000);

                if (unlockAt > new Date()) {
                    return {
                        locked: true,
                        reason: 'Account temporarily locked due to multiple failed login attempts',
                        unlockAt,
                    };
                }
            }

            return { locked: false };
        } catch (error) {
            log.error('Account lock check failed', error);
            return { locked: false }; // Fail open
        }
    },

    /**
     * Record a login attempt (success or failure)
     */
    async recordLoginAttempt(
        identifier: string,
        success: boolean,
        context: {
            userId?: string;
            method: 'password' | 'otp' | 'google';
            ipAddress?: string;
            userAgent?: string;
            failureReason?: string;
        }
    ): Promise<void> {
        try {
            await supabaseAdmin.from('login_history').insert({
                user_id: context.userId || null,
                login_identifier: identifier,
                login_method: context.method,
                success,
                failure_reason: success ? null : context.failureReason,
                ip_address: context.ipAddress || null,
                user_agent: context.userAgent || null,
            });

            // If failed, update Redis for faster lookups
            if (!success && features.upstashRedis) {
                const cacheKey = `lockout:${identifier}`;
                await checkRateLimit(
                    cacheKey,
                    LOCKOUT_CONFIG.maxFailedAttempts,
                    LOCKOUT_CONFIG.lockoutWindowMinutes * 60 * 1000
                );
            }

            log.info(`Login attempt recorded: ${identifier} - ${success ? 'success' : 'failed'}`);
        } catch (error) {
            log.error('Failed to record login attempt', error);
        }
    },

    /**
     * Invalidate all sessions for a user (e.g., on password change)
     */
    async invalidateAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
        try {
            let query = supabaseAdmin
                .from('user_sessions')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);

            if (exceptSessionId) {
                query = query.neq('id', exceptSessionId);
            }

            const { data, error } = await query.select('id');

            if (error) {
                log.error('Failed to invalidate sessions', error);
                return 0;
            }

            const invalidatedCount = data?.length || 0;
            log.info(`Invalidated ${invalidatedCount} sessions for user ${userId}`);
            return invalidatedCount;
        } catch (error) {
            log.error('Session invalidation failed', error);
            return 0;
        }
    },

    /**
     * Check if a specific session is still valid
     */
    async isSessionValid(sessionId: string): Promise<boolean> {
        try {
            const { data, error } = await supabaseAdmin
                .from('user_sessions')
                .select('id, is_active, expires_at')
                .eq('id', sessionId)
                .single();

            if (error || !data) return false;

            return data.is_active && new Date(data.expires_at) > new Date();
        } catch (error) {
            log.error('Session validity check failed', error);
            return false;
        }
    },

    /**
     * Clean up expired sessions and old login history
     */
    async runSecurityCleanup(): Promise<{ sessions: number; loginHistory: number }> {
        try {
            // Delete expired sessions
            const { data: deletedSessions } = await supabaseAdmin
                .from('user_sessions')
                .delete()
                .lt('expires_at', new Date().toISOString())
                .select('id');

            // Delete old login history (keep 90 days)
            const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            const { data: deletedHistory } = await supabaseAdmin
                .from('login_history')
                .delete()
                .lt('created_at', cutoffDate)
                .select('id');

            const result = {
                sessions: deletedSessions?.length || 0,
                loginHistory: deletedHistory?.length || 0,
            };

            log.info(`Security cleanup: ${result.sessions} sessions, ${result.loginHistory} login history entries removed`);
            return result;
        } catch (error) {
            log.error('Security cleanup failed', error);
            return { sessions: 0, loginHistory: 0 };
        }
    },
};
