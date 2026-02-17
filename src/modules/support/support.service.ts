import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type {
    SupportTicketDTO,
    SupportTicketDetailDTO,
    TicketMessageDTO,
    TicketFilters,
} from './support.types.js';
import type {
    CreateTicketInput,
    ReplyTicketInput,
    UpdateTicketInput,
    ResolveTicketInput,
    RateTicketInput,
} from './support.validator.js';

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
    async create(userId: string, input: CreateTicketInput): Promise<SupportTicketDTO> {
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
                appointment_id: input.appointmentId || null,
                medicine_order_id: input.medicineOrderId || null,
                payment_id: input.paymentId || null,
                attachments: input.attachments || null,
                status: 'open',
                sla_breached: false,
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create ticket', error);
            throw new BadRequestError('Failed to create support ticket');
        }

        return this.transformTicket(data);
    }

    /**
     * List tickets with filters
     */
    async list(filters: TicketFilters): Promise<{ tickets: SupportTicketDTO[]; total: number; page: number; limit: number; totalPages: number }> {
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
            tickets: (data || []).map(t => this.transformTicket(t)),
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        };
    }

    /**
     * Get ticket by ID with messages
     */
    async getById(ticketId: string): Promise<SupportTicketDetailDTO> {
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

        // Get messages (was "ticket_replies" — DB table is "ticket_messages")
        const { data: messages } = await this.supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        const dto = this.transformTicket(ticket) as SupportTicketDetailDTO;
        dto.messages = (messages || []).map(m => this.transformMessage(m));
        dto.user = ticket.user || undefined;
        return dto;
    }

    /**
     * Get user's tickets
     */
    async getUserTickets(userId: string, page = 1, limit = 20): Promise<{ tickets: SupportTicketDTO[]; total: number; page: number; limit: number; totalPages: number }> {
        return this.list({ userId, page, limit });
    }

    /**
     * Add message to ticket
     */
    async reply(ticketId: string, userId: string, userRole: string, input: ReplyTicketInput): Promise<TicketMessageDTO> {
        // Verify ticket exists
        const { data: ticket, error: ticketError } = await this.supabase
            .from('support_tickets')
            .select('id, status, first_response_at')
            .eq('id', ticketId)
            .single();

        if (ticketError || !ticket) {
            throw new NotFoundError('Ticket not found');
        }

        const { data, error } = await this.supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: userId,
                sender_role: userRole,
                message: input.message,
                attachments: input.attachments || null,
                is_internal: input.isInternal || false,
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to add message', error);
            throw new BadRequestError('Failed to add message');
        }

        // Update ticket: set first_response_at if admin's first reply
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        if (ticket.status === 'open') {
            updateData.status = 'in_progress';
        }
        if (!ticket.first_response_at && userRole === 'admin') {
            updateData.first_response_at = new Date().toISOString();
        }

        await this.supabase
            .from('support_tickets')
            .update(updateData)
            .eq('id', ticketId);

        return this.transformMessage(data);
    }

    /**
     * Update ticket (status, priority, assignment)
     */
    async update(ticketId: string, userId: string, input: UpdateTicketInput): Promise<SupportTicketDTO> {
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

        if (input.status !== undefined) updateData.status = input.status;
        if (input.priority !== undefined) updateData.priority = input.priority;
        if (input.assignedTo !== undefined) {
            updateData.assigned_to = input.assignedTo;
            updateData.assigned_at = input.assignedTo ? new Date().toISOString() : null;
        }

        const { data, error } = await this.supabase
            .from('support_tickets')
            .update(updateData)
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update ticket', error);
            throw new BadRequestError('Failed to update ticket');
        }

        return this.transformTicket(data);
    }

    /**
     * Resolve ticket
     */
    async resolve(ticketId: string, userId: string, input: ResolveTicketInput): Promise<SupportTicketDTO> {
        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({
                status: 'resolved',
                resolution_notes: input.resolutionNotes,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to resolve ticket', error);
            throw new BadRequestError('Failed to resolve ticket');
        }

        return this.transformTicket(data);
    }

    /**
     * Close ticket
     */
    async close(ticketId: string): Promise<SupportTicketDTO> {
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
            this.log.error('Failed to close ticket', error);
            throw new BadRequestError('Failed to close ticket');
        }

        return this.transformTicket(data);
    }

    /**
     * Rate resolved ticket (customer satisfaction)
     */
    async rate(ticketId: string, userId: string, input: RateTicketInput): Promise<SupportTicketDTO> {
        // Verify ticket is resolved/closed and belongs to the user
        const { data: ticket, error: fetchError } = await this.supabase
            .from('support_tickets')
            .select('id, user_id, status')
            .eq('id', ticketId)
            .single();

        if (fetchError || !ticket) {
            throw new NotFoundError('Ticket not found');
        }
        if (ticket.user_id !== userId) {
            throw new BadRequestError('You can only rate your own tickets');
        }
        if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
            throw new BadRequestError('Can only rate resolved or closed tickets');
        }

        const { data, error } = await this.supabase
            .from('support_tickets')
            .update({
                satisfaction_rating: input.satisfactionRating,
                satisfaction_feedback: input.satisfactionFeedback || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to rate ticket', error);
            throw new BadRequestError('Failed to rate ticket');
        }

        return this.transformTicket(data);
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

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    private transformTicket(row: any): SupportTicketDTO {
        return {
            id: row.id,
            ticketNumber: row.ticket_number,
            userId: row.user_id,
            category: row.category,
            priority: row.priority,
            subject: row.subject,
            description: row.description,
            appointmentId: row.appointment_id,
            medicineOrderId: row.medicine_order_id,
            paymentId: row.payment_id,
            attachments: row.attachments,
            status: row.status,
            assignedTo: row.assigned_to,
            assignedAt: row.assigned_at,
            resolvedAt: row.resolved_at,
            resolvedBy: row.resolved_by,
            resolutionNotes: row.resolution_notes,
            satisfactionRating: row.satisfaction_rating,
            satisfactionFeedback: row.satisfaction_feedback,
            firstResponseAt: row.first_response_at,
            slaDueAt: row.sla_due_at,
            slaBreached: row.sla_breached,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private transformMessage(row: any): TicketMessageDTO {
        return {
            id: row.id,
            ticketId: row.ticket_id,
            senderId: row.sender_id,
            senderRole: row.sender_role,
            message: row.message,
            attachments: row.attachments,
            isInternal: row.is_internal,
            createdAt: row.created_at,
        };
    }
}

export const supportService = new SupportService();
