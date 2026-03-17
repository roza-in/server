import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';
import type { PaginatedMeta } from './admin.types.js';
import crypto from 'crypto';

/**
 * Admin Security Service
 * 
 * Handles security monitoring and governance:
 *   - Active sessions
 *   - Login history
 *   - OTP monitoring
 *   - Webhook events
 *   - API keys
 */
class AdminSecurityService {
    private supabase = supabaseAdmin;
    private log = logger.child('AdminSecurityService');

    // =========================================================================
    // SESSIONS
    // =========================================================================

    async listActiveSessions(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('user_sessions')
            .select('*, user:users(id, first_name, last_name, email, phone, role)', { count: 'exact' })
            .eq('is_active', true);

        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            // Search by user email or name via join is tricky in Supabase basic query, 
            // relying on client headers/IP search for now or id
            if (s) query = query.or(`ip_address.ilike.%${s}%,user_agent.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('last_active_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list active sessions', error);
            throw new BadRequestError('Failed to list active sessions');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async revokeSession(sessionId: string) {
        const { error } = await this.supabase
            .from('user_sessions')
            .update({ is_active: false, revoked_at: new Date().toISOString() } as any)
            .eq('id', sessionId);

        if (error) {
            this.log.error('Failed to revoke session', error);
            throw new BadRequestError('Failed to revoke session');
        }
        return { success: true };
    }

    async revokeAllUserSessions(userId: string) {
        const { data, error } = await this.supabase
            .from('user_sessions')
            .update({ is_active: false, revoked_at: new Date().toISOString() } as any)
            .eq('user_id', userId)
            .eq('is_active', true)
            .select('id');

        if (error) {
            this.log.error('Failed to revoke all user sessions', error);
            throw new BadRequestError('Failed to revoke all user sessions');
        }
        return { revoked: data?.length || 0 };
    }

    // =========================================================================
    // LOGIN HISTORY
    // =========================================================================

    async listLoginActivity(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('login_history')
            .select('*', { count: 'exact' });

        if (filters.success !== undefined) query = query.eq('success', filters.success === 'true' || filters.success === true);
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.ipAddress) query = query.eq('ip_address', filters.ipAddress);
        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.or(`ip_address.ilike.%${s}%,user_agent.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list login history', error);
            throw new BadRequestError('Failed to list login history');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getGeographicStats() {
        // Simplified: group by IP or some other metric if available. 
        // For now, just return success vs failure counts
        const [
            { count: success },
            { count: failure }
        ] = await Promise.all([
            this.supabase.from('login_history').select('id', { count: 'exact', head: true }).eq('success', true),
            this.supabase.from('login_history').select('id', { count: 'exact', head: true }).eq('success', false)
        ]);

        return { success: success || 0, failure: failure || 0 };
    }

    // =========================================================================
    // OTP MONITORING
    // =========================================================================

    async listOtpActivity(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('otp_codes')
            .select('*', { count: 'exact' });

        if (filters.identifier) query = query.ilike('identifier', `%${filters.identifier}%`);
        if (filters.purpose) query = query.eq('purpose', filters.purpose);
        if (filters.isUsed !== undefined) query = query.eq('is_used', filters.isUsed === 'true');

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list OTP activity', error);
            throw new BadRequestError('Failed to list OTP activity');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getOtpStats() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { count: lastHour } = await this.supabase
            .from('otp_codes')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneHourAgo);

        const { count: failures } = await this.supabase
            .from('otp_codes')
            .select('id', { count: 'exact', head: true })
            .gte('attempts', 3); // Assuming > 3 attempts is suspicious

        return { lastHour: lastHour || 0, highAttempts: failures || 0 };
    }

    // =========================================================================
    // WEBHOOKS
    // =========================================================================

    async listWebhookEvents(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('gateway_webhook_events')
            .select('*', { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.provider) query = query.eq('provider', filters.provider);
        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.ilike('event_id', `%${s}%`);
        }

        const { data, error, count } = await query
            .order('received_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list webhooks', error);
            throw new BadRequestError('Failed to list webhooks');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getWebhookStats() {
        const [
            { count: total },
            { count: success },
            { count: failed },
            { count: pending }
        ] = await Promise.all([
            this.supabase.from('gateway_webhook_events').select('id', { count: 'exact', head: true }),
            this.supabase.from('gateway_webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'processed' as any),
            this.supabase.from('gateway_webhook_events').select('id', { count: 'exact', head: true }).in('status', ['failed', 'error']),
            this.supabase.from('gateway_webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'pending' as any),
        ]);

        return { total: total || 0, success: success || 0, failed: failed || 0, pending: pending || 0 };
    }

    async retryWebhook(eventId: string) {
        // Reset status to pending so the worker picks it up
        const { data, error } = await this.supabase
            .from('gateway_webhook_events')
            .update({ status: 'pending', error_message: null, retry_count: 0 } as any)
            .eq('id', eventId)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to retry webhook', error);
            throw new BadRequestError('Failed to retry webhook');
        }
        return data;
    }

    // =========================================================================
    // API KEYS
    // =========================================================================

    async listApiKeys(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('api_keys')
            .select('*', { count: 'exact' });

        if (filters.isActive !== undefined) {
            if (filters.isActive === 'true') query = query.is('revoked_at', null);
            else query = query.not('revoked_at', 'is', null);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list API keys', error);
            throw new BadRequestError('Failed to list API keys');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async createApiKey(data: { name: string; scopes: string[], rateLimit?: number, expiresAt?: string }) {
        // Generate a secure key
        const keyPrefix = 'rozx_';
        const randomBytes = crypto.randomBytes(24).toString('hex');
        const apiKey = `${keyPrefix}${randomBytes}`;

        // Hash it for storage
        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { data: record, error } = await this.supabase
            .from('api_keys')
            .insert({
                name: data.name,
                key_hash: hashedKey,
                prefix: apiKey.substring(0, 8),
                scopes: data.scopes,
                rate_limit_per_minute: data.rateLimit || 60,
                expires_at: data.expiresAt || null,
                is_active: true
            } as any)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create API key', error);
            throw new BadRequestError('Failed to create API key');
        }

        // Return the full key only once
        return { ...record, fullKey: apiKey };
    }

    async revokeApiKey(id: string) {
        const { data, error } = await this.supabase
            .from('api_keys')
            .update({ revoked_at: new Date().toISOString(), is_active: false } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to revoke API key', error);
            throw new BadRequestError('Failed to revoke API key');
        }
        return data;
    }
}

export const adminSecurityService = new AdminSecurityService();
