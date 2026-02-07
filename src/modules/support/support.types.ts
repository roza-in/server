// ============================================================================
// Support Module Types (Support Tickets)
// ============================================================================

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'appointment' | 'payment' | 'technical' | 'refund' | 'account' | 'other';

export interface SupportTicket {
    id: string;
    ticket_number: string;
    user_id: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    appointment_id: string | null;
    payment_id: string | null;
    assigned_to: string | null;
    resolved_at: string | null;
    resolution: string | null;
    created_at: string;
    updated_at: string;
}

export interface TicketReply {
    id: string;
    ticket_id: string;
    user_id: string;
    message: string;
    attachments: string[] | null;
    is_internal: boolean;
    created_at: string;
}

export interface TicketFilters {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    userId?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface CreateTicketInput {
    subject: string;
    description: string;
    category: TicketCategory;
    priority?: TicketPriority;
    appointment_id?: string;
    payment_id?: string;
}

export interface ReplyTicketInput {
    message: string;
    attachments?: string[];
    is_internal?: boolean;
}

export interface UpdateTicketInput {
    status?: TicketStatus;
    priority?: TicketPriority;
    assigned_to?: string;
}

export interface ResolveTicketInput {
    resolution: string;
}

