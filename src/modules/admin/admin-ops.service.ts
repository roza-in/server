import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';
import type {
    AdminNotificationFilters,
    AdminSupportFilters,
    AdminVerificationFilters,
    AdminReportFilters,
    AdminSystemLogFilters,
    PaginatedMeta
} from './admin.types.js';

/**
 * Admin Operations Service
 * 
 * Handles operational monitoring and governance:
 *   - Notification queue & delivery
 *   - Support ticket system
 *   - Hospital verification workflow
 *   - Scheduled reports
 *   - System logs & health
 */
class AdminOpsService {
    private supabase = supabaseAdmin;
    private log = logger.child('AdminOpsService');

    // =========================================================================
    // NOTIFICATIONS
    // =========================================================================

    async listNotificationQueue(filters: AdminNotificationFilters = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('notification_queue')
            .select('*, notification:notifications(*, user:users(id, name, email))', { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.channel) query = query.eq('channel', filters.channel);
        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.or(`recipient.ilike.%${s}%,last_error.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list notification queue', error);
            throw new BadRequestError('Failed to list notification queue');
        }

        const total = count || 0;
        const meta: PaginatedMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        return { data, meta };
    }

    async retryNotification(id: string) {
        const { data, error } = await this.supabase
            .from('notification_queue')
            .update({
                status: 'pending',
                attempts: 0,
                next_attempt_at: new Date().toISOString(),
                last_error: null
            } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to retry notification', error);
            throw new BadRequestError('Failed to retry notification');
        }

        return data;
    }

    // =========================================================================
    // SUPPORT TICKETS
    // =========================================================================

    async listSupportTickets(filters: AdminSupportFilters = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('support_tickets')
            .select('*, user:users(id, name, email), assigned:users!assigned_to(id, name)', { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.or(`subject.ilike.%${s}%,ticket_number.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list support tickets', error);
            throw new BadRequestError('Failed to list support tickets');
        }

        const total = count || 0;
        const meta: PaginatedMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        return { data, meta };
    }

    async getSupportTicket(id: string) {
        const { data: ticket, error: ticketError } = await this.supabase
            .from('support_tickets')
            .select('*, user:users(id, name, email, phone), assigned:users!assigned_to(id, name), resolved_by_user:users!resolved_by(id, name)')
            .eq('id', id)
            .single();

        if (ticketError || !ticket) {
            throw new NotFoundError('Support ticket not found');
        }

        const { data: messages, error: messagesError } = await this.supabase
            .from('ticket_messages')
            .select('*, sender:users(id, name, role)')
            .eq('ticket_id', id)
            .order('created_at', { ascending: true });

        if (messagesError) {
            this.log.error('Failed to fetch ticket messages', messagesError);
        }

        return { ...ticket, messages: messages || [] };
    }

    async updateTicket(id: string, payload: any) {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update support ticket', error);
            throw new BadRequestError('Failed to update support ticket');
        }

        return data;
    }

    async addTicketMessage(ticketId: string, senderId: string, payload: { message: string, is_internal?: boolean, attachments?: string[] }) {
        // First verify ticket exists
        const { data: ticket, error: ticketError } = await this.supabase
            .from('support_tickets')
            .select('id, user_id')
            .eq('id', ticketId)
            .single();

        if (ticketError || !ticket) throw new NotFoundError('Ticket not found');

        // Check sender role (simplified, assuming caller is admin)
        const { data: sender, error: senderError } = await this.supabase
            .from('users')
            .select('role')
            .eq('id', senderId)
            .single();

        if (senderError || !sender) throw new NotFoundError('Sender not found');

        const { data, error } = await this.supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: senderId,
                sender_role: sender.role,
                message: payload.message,
                is_internal: payload.is_internal || false,
                attachments: payload.attachments || []
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to add ticket message', error);
            throw new BadRequestError('Failed to add ticket message');
        }

        // Update ticket's updated_at
        await this.supabase.from('support_tickets').update({ updated_at: new Date().toISOString() } as any).eq('id', ticketId);

        return data;
    }

    // =========================================================================
    // HOSPITAL VERIFICATIONS
    // =========================================================================

    async listHospitalVerifications(filters: AdminVerificationFilters = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('hospitals')
            .select(`
                *,
                requester:users!admin_user_id(id, name)
            `, { count: 'exact' });

        if (filters.status) {
            query = query.eq('verification_status', filters.status);
        } else {
            // Default to showing verifications (not already verified)
            query = query.neq('verification_status', 'verified');
        }

        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) {
                query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%,registration_number.ilike.%${s}%,email.ilike.%${s}%`);
            }
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list hospital verifications', error);
            throw new BadRequestError('Failed to list hospital verifications');
        }

        const total = count || 0;
        const meta: PaginatedMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        return { data, meta };
    }

    async resolveVerification(id: string, adminId: string, payload: { status: string, rejection_reason?: string, review_notes?: string, license_number?: string }) {
        const updateData: any = {
            verification_status: payload.status,
            rejection_reason: payload.rejection_reason,
            review_notes: payload.review_notes,
            license_number: payload.license_number,
            verified_by: adminId,
            verified_at: payload.status === 'verified' || payload.status === 'approved' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('hospitals')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to resolve verification', error);
            throw new BadRequestError('Failed to resolve verification');
        }

        return data;
    }

    // =========================================================================
    // SCHEDULED REPORTS
    // =========================================================================

    async listScheduledReports(filters: AdminReportFilters = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('scheduled_reports')
            .select('*, creator:users!created_by(id, name)', { count: 'exact' });

        if (filters.type) query = query.eq('report_type', filters.type);
        if (typeof filters.isActive === 'boolean') query = query.eq('is_active', filters.isActive);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list scheduled reports', error);
            throw new BadRequestError('Failed to list scheduled reports');
        }

        const total = count || 0;
        const meta: PaginatedMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        return { data, meta };
    }

    async toggleReportStatus(id: string, isActive: boolean) {
        const { data, error } = await this.supabase
            .from('scheduled_reports')
            .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to toggle report status', error);
            throw new BadRequestError('Failed to toggle report status');
        }

        return data;
    }

    // =========================================================================
    // SYSTEM LOGS
    // =========================================================================

    async listSystemLogs(filters: AdminSystemLogFilters = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 50, 200);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('system_logs')
            .select('*', { count: 'exact' });

        if (filters.level) query = query.eq('level', filters.level);
        if (filters.module) query = query.eq('module', filters.module);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);

        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.or(`message.ilike.%${s}%,error_code.ilike.%${s}%,error_stack.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list system logs', error);
            throw new BadRequestError('Failed to list system logs');
        }

        const total = count || 0;
        const meta: PaginatedMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        };

        return { data, meta };
    }

    // =========================================================================
    // STATS
    // =========================================================================

    async getOperationalStats() {
        const results = await Promise.all([
            this.supabase.from('notification_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            this.supabase.from('notification_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
            this.supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
            this.supabase.from('hospitals').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
            this.supabase.from('doctors').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
            this.supabase.from('system_logs').select('*', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);

        const [
            { count: pendingNotifs },
            { count: failedNotifs },
            { count: openTickets },
            { count: pendingHospitals },
            { count: pendingDoctors },
            { count: systemErrors }
        ] = results;

        return {
            notifications: {
                pending: pendingNotifs || 0,
                failed: failedNotifs || 0
            },
            support: {
                openTickets: openTickets || 0
            },
            verifications: {
                pending: (pendingHospitals || 0) + (pendingDoctors || 0)
            },
            health: {
                errorsLast24h: systemErrors || 0
            }
        };
    }


}

export const adminOpsService = new AdminOpsService();
