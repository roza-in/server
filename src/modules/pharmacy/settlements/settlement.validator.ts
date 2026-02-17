/**
 * Pharmacy Settlement Validators
 * Zod schemas for pharmacy settlement request validation
 */

import { z } from 'zod';

export const calculateSettlementSchema = z.object({
    body: z.object({
        hospitalId: z.string().uuid('Invalid hospital ID'),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (YYYY-MM-DD)'),
    }),
});

export const processSettlementSchema = z.object({
    body: z.object({
        paymentMode: z.enum(['neft', 'rtgs', 'imps', 'upi', 'bank_transfer']),
        utrNumber: z.string().max(100).optional(),
    }),
});

export const listSettlementsSchema = z.object({
    query: z.object({
        hospitalId: z.string().uuid().optional(),
        status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'on_hold', 'partially_paid']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
    }).optional(),
});
