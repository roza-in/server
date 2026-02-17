import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../common/validators.js';

/**
 * Settlement validators — Zod schemas for request validation
 */

// Enum schemas matching database enums
const settlementStatusSchema = z.enum([
  'pending', 'processing', 'completed', 'failed', 'cancelled', 'on_hold', 'partially_paid',
]);
const entityTypeSchema = z.enum(['hospital', 'pharmacy']);

// ============================================================
// SETTLEMENT SCHEMAS
// ============================================================

/** List settlements (admin) */
export const listSettlementsSchema = z.object({
  query: z.object({
    ...paginationSchema.shape,
    status: settlementStatusSchema.optional(),
    entityType: entityTypeSchema.optional(),
    entityId: uuidSchema.optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  }),
});

/** Get settlement by ID */
export const getSettlementSchema = z.object({
  params: z.object({
    settlementId: uuidSchema,
  }),
});

/** Calculate (create) a new settlement */
export const calculateSettlementSchema = z.object({
  body: z.object({
    entityType: entityTypeSchema,
    entityId: uuidSchema,
    periodStart: z.string().date('Invalid date format (YYYY-MM-DD)'),
    periodEnd: z.string().date('Invalid date format (YYYY-MM-DD)'),
  }),
});

/** Approve a pending settlement */
export const approveSettlementSchema = z.object({
  params: z.object({
    settlementId: uuidSchema,
  }),
});

/** Initiate payout for approved settlement */
export const initiatePayoutSchema = z.object({
  params: z.object({
    settlementId: uuidSchema,
  }),
});

/** Mark settlement as completed (admin provides UTR) */
export const completeSettlementSchema = z.object({
  params: z.object({
    settlementId: uuidSchema,
  }),
  body: z.object({
    utrNumber: z.string().min(1, 'UTR number is required').max(100),
  }),
});

/** Get my settlements (hospital user) */
export const getMySettlementsSchema = z.object({
  query: paginationSchema,
});

/** Get settlement stats (admin) */
export const getSettlementStatsSchema = z.object({
  query: z.object({
    entityType: entityTypeSchema.optional(),
    entityId: uuidSchema.optional(),
  }).optional(),
});
