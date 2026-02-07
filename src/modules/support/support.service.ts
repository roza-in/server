import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type { TicketFilters, CreateTicketInput, ReplyTicketInput, UpdateTicketInput, ResolveTicketInput } from './support.types.js';

/**
 * Support Service - Domain module for support tickets
 */
class SupportService {
    private supabase = supabaseAdmin;
    private log = logger.child('SupportService');

    private generateTicketNumber(): string {
        return `TKT-${Date.now().toString(36).toUpperCase()}`;
    }

    /**
     * Create support ticket
     */
    async create(userId: string, input: CreateTicketInput): Promise<any> {
        const ticketNumber = this.generateTicketNumber();

        const { data, error } = await this.supabase
            .from('support_tickets')
            .insert({
                ticket_number: ticketNumber,
                user_id: userId,
                subject: input.subject,
                description: input.description,
                category: input.category,
                priority: input.priority || 'medium',
                appointment_id: input.appointment_id || null,
                payment_id: input.payment_id || null,
                status: 'open',
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create ticket', error);
            throw new BadRequestError('Failed to create support ticket');
        }

        return data;
    }

    /**
     * List tickets with filters
     */
    async list(filters: TicketFilters): Promise<any> {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('support_tickets')
            .select(`
        *,
        user:users!support_tickets_user_id_fkey(id, name, email)
      `, { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
        if (filters.search) {
            // SECURITY: Sanitize search input to prevent PostgREST filter injection
            const sanitizedSearch = filters.search
                .replace(/[%_(),.]/g, '') // Remove special PostgREST filter characters
                .replace(/'/g, "''")       // Escape single quotes
                .substring(0, 100);        // Limit length to prevent abuse
            if (sanitizedSearch.length > 0) {
                query = query.or(`subject.ilike.%${sanitizedSearch}%,ticket_number.ilike.%${sanitizedSearch}%`);
            }
        }

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            this.log.error('Failed to list tickets', error);
            throw new BadRequestError('Failed to list tickets');
        }

        return {
            tickets: data || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        };
    }

    /**
     * Get ticket by ID with replies
     */
    async getById(ticketId: string): Promise<any> {
        const { data: ticket, error } = await this.supabase
            .from('support_tickets')
            .select(`
        *,
        user:users!support_tickets_user_id_fkey(id, name, email, phone)
      `)
            .eq('id', ticketId)
            .single();

        if (error || !ticket) {
            throw new NotFoundError('Ticket not found');
        }

        // Get replies
        const { data: replies } = await this.supabase
            .from('ticket_replies')
            .select(`
        *,
        user:users(id, name, role)
      `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        return { ...ticket, replies: replies || [] };
    }

    /**
     * Get user's tickets
     */
    async getUserTickets(userId: string, page = 1, limit = 20): Promise<any> {
        return this.list({ userId, page, limit });
    }

    /**
     * Add reply to ticket
     */
    async reply(ticketId: string, userId: string, input: ReplyTicketInput): Promise<any> {
        const { data, error } = await this.supabase
            .from('ticket_replies')
            .insert({
                ticket_id: ticketId,
                user_id: userId,
                message: input.message,
                attachments: input.attachments || [],
                is_internal: input.is_internal || false,
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to add reply', error);
            throw new BadRequestError('Failed to add reply');
        }

        // Update ticket status to in_progress if it was open
        await this.supabase
            .from('support_tickets')
            .update({ status: 'in_progress', updated_at: new Date().toISOString() })
            .eq('id', ticketId)
            .eq('status', 'open');

        return data;
    }

    /**
     * Update ticket (status, priority, assignment)
     */
    async update(ticketId: string, input: UpdateTicketInput): Promise<any> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({
                ...input,
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            throw new BadRequestError('Failed to update ticket');
        }

        return data;
    }

    /**
     * Resolve ticket
     */
    async resolve(ticketId: string, input: ResolveTicketInput): Promise<any> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({
                status: 'resolved',
                resolution: input.resolution,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            throw new BadRequestError('Failed to resolve ticket');
        }

        return data;
    }

    /**
     * Close ticket
     */
    async close(ticketId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({
                status: 'closed',
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            throw new BadRequestError('Failed to close ticket');
        }

        return data;
    }

    /**
     * Get ticket stats
     */
    async getStats(): Promise<any> {
        const [open, inProgress, resolved] = await Promise.all([
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
            this.supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
        ]);

        return {
            openCount: open.count || 0,
            inProgressCount: inProgress.count || 0,
            resolvedCount: resolved.count || 0,
        };
    }
}

export const supportService = new SupportService();

