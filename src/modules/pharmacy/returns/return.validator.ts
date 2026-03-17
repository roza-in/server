/**
 * Medicine Return Validators
 * Zod schemas for return request validation
 */

import { z } from 'zod';

export const createReturnSchema = z.object({
    body: z.object({
        reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
        reasonDetails: z.string().max(1000).optional(),
        items: z.array(z.object({
            medicineId: z.string().uuid('Invalid medicine ID'),
            quantity: z.number().int().min(1, 'Quantity must be at least 1'),
            reason: z.string().max(500).optional(),
        })).min(1, 'At least one item required'),
        photos: z.array(z.string().url()).max(10).optional(),
        refundAmount: z.number().min(0).optional(),
    }),
});

export const reviewReturnSchema = z.object({
    body: z.object({
        status: z.enum(['approved', 'rejected']),
        reviewNotes: z.string().max(1000).optional(),
        refundAmount: z.number().min(0).optional(),
        schedulePickup: z.boolean().optional(),
    }),
});

export const listReturnsSchema = z.object({
    query: z.object({
        orderId: z.string().uuid().optional(),
        status: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
    }).optional(),
});
