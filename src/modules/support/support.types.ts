// ============================================================================
// Support Module Types (Support Tickets)
//
// Response DTOs — camelCase transforms of DB snake_case rows.
// Input types are inferred from Zod schemas in support.validator.ts.
// ============================================================================

// Re-export canonical enums from database types
export type { TicketStatus, TicketPriority, TicketCategory } from '../../types/database.types.js';

/** Support ticket response DTO */
export interface SupportTicketDTO {
    id: string;
    ticketNumber: string | null;
    userId: string;
    category: string;
    priority: string;
    subject: string;
    description: string;
    appointmentId: string | null;
    medicineOrderId: string | null;
    paymentId: string | null;
    attachments: string[] | null;
    status: string;
    assignedTo: string | null;
    assignedAt: string | null;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNotes: string | null;
    satisfactionRating: number | null;
    satisfactionFeedback: string | null;
    firstResponseAt: string | null;
    slaDueAt: string | null;
    slaBreached: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Ticket message response DTO (was "TicketReply") */
export interface TicketMessageDTO {
    id: string;
    ticketId: string;
    senderId: string;
    senderRole: string;
    message: string;
    attachments: string[] | null;
    isInternal: boolean;
    createdAt: string;
}

/** Ticket with messages for detail view */
export interface SupportTicketDetailDTO extends SupportTicketDTO {
    messages: TicketMessageDTO[];
    user?: { id: string; name: string; email: string; phone: string };
}

/** Ticket list filters */
export interface TicketFilters {
    status?: string;
    priority?: string;
    category?: string;
    userId?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
}