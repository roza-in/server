import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../common/validators.js';

/**
 * Support ticket validators using Zod
 */

// Enums matching database
const ticketStatusSchema = z.enum([
  'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed',
]);
const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const ticketCategorySchema = z.enum([
  'appointment', 'payment', 'refund', 'medicine_order', 'technical', 'feedback', 'other',
]);

// ============================================================
// TICKET SCHEMAS
// ============================================================

/** Create a support ticket */
export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(5).max(200),
    description: z.string().min(10).max(5000),
    category: ticketCategorySchema,
    priority: ticketPrioritySchema.optional().default('medium'),
    appointmentId: uuidSchema.optional(),
    medicineOrderId: uuidSchema.optional(),
    paymentId: uuidSchema.optional(),
    attachments: z.array(z.string().url()).max(5).optional(),
  }),
});

/** List tickets with filters */
export const listTicketsSchema = z.object({
  query: z.object({
    ...paginationSchema.shape,
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    category: ticketCategorySchema.optional(),
    assignedTo: uuidSchema.optional(),
    search: z.string().max(100).optional(),
  }),
});

/** Get my tickets */
export const getMyTicketsSchema = z.object({
  query: paginationSchema,
});

/** Get ticket by ID */
export const getTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
});

/** Reply to ticket (add message) */
export const replyTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
  body: z.object({
    message: z.string().min(1).max(5000),
    attachments: z.array(z.string().url()).max(5).optional(),
    isInternal: z.boolean().optional().default(false),
  }),
});

/** Update ticket (admin: status, priority, assignment) */
export const updateTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
  body: z.object({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assignedTo: uuidSchema.nullable().optional(),
  }),
});

/** Resolve ticket */
export const resolveTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
  body: z.object({
    resolutionNotes: z.string().min(5).max(2000),
  }),
});

/** Close ticket */
export const closeTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
});

/** Rate resolved ticket (customer satisfaction) */
export const rateTicketSchema = z.object({
  params: z.object({
    ticketId: uuidSchema,
  }),
  body: z.object({
    satisfactionRating: z.number().min(1).max(5),
    satisfactionFeedback: z.string().max(1000).optional(),
  }),
});

// ============================================================
// EXPORTED TYPES
// ============================================================

export type CreateTicketInput = z.infer<typeof createTicketSchema>['body'];
export type ListTicketsInput = z.infer<typeof listTicketsSchema>['query'];
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>['body'];
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>['body'];
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>['body'];
export type RateTicketInput = z.infer<typeof rateTicketSchema>['body'];
