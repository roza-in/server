import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../common/validators.js';

// ============================================================================
// Refund Validators
// ============================================================================

const refundReasonEnum = z.enum([
    'patient_cancelled',
    'doctor_cancelled',
    'hospital_cancelled',
    'technical_failure',
    'policy_violation',
    'admin_override',
    'chargeback',
    'duplicate_payment',
    'service_not_rendered',
]);

const refundStatusEnum = z.enum([
    'pending',
    'approved',
    'processing',
    'completed',
    'rejected',
]);

/**
 * POST /api/v1/refunds
 */
export const createRefundSchema = z.object({
    body: z.object({
        payment_id: uuidSchema,
        refund_amount: z.number().positive(),
        reason: refundReasonEnum,
        reason_details: z.string().max(1000).optional(),
        cancellation_fee: z.number().min(0).optional(),
        policy_applied: z.string().max(200).optional(),
    }),
});

/**
 * GET /api/v1/refunds
 */
export const listRefundsSchema = z.object({
    query: paginationSchema.extend({
        payment_id: uuidSchema.optional(),
        status: refundStatusEnum.optional(),
        reason: refundReasonEnum.optional(),
        initiated_by: uuidSchema.optional(),
    }),
});

/**
 * GET /api/v1/refunds/:refundId
 */
export const getRefundSchema = z.object({
    params: z.object({
        refundId: uuidSchema,
    }),
});

/**
 * POST /api/v1/refunds/:refundId/process
 */
export const processRefundSchema = z.object({
    params: z.object({
        refundId: uuidSchema,
    }),
    body: z.object({
        action: z.enum(['approve', 'reject']),
        notes: z.string().max(1000).optional(),
    }),
});
