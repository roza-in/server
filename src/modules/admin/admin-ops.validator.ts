import { z } from 'zod';

export const listNotificationQueueSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        status: z.string().optional(),
        channel: z.string().optional(),
        search: z.string().optional(),
    }),
});

export const retryNotificationSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const listSupportTicketsSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        category: z.string().optional(),
        assignedTo: z.string().uuid().optional(),
        search: z.string().optional(),
    }),
});

export const getSupportTicketSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const updateTicketSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
        resolution_notes: z.string().optional(),
    }).strict(),
});

export const addTicketMessageSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        message: z.string().min(1),
        is_internal: z.boolean().default(false),
        attachments: z.array(z.string()).default([]),
    }),
});

export const listHospitalVerificationsSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
    }),
});

export const resolveVerificationSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        status: z.enum(['verified', 'rejected', 'under_review']),
        rejection_reason: z.string().optional(),
        review_notes: z.string().optional(),
    }),
});

export const listScheduledReportsSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        type: z.string().optional(),
        isActive: z.string().transform(v => v === 'true').optional(),
    }),
});

export const toggleReportSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        isActive: z.boolean(),
    }),
});

export const listSystemLogsSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        level: z.string().optional(),
        module: z.string().optional(),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }),
});
