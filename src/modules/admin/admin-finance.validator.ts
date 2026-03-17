import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

// ============================================================================
// Shared Schemas
// ============================================================================

const paginationQuery = {
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
};

const dateRangeQuery = {
    startDate: z.string().optional(),
    endDate: z.string().optional(),
};

const idParams = {
    id: uuidSchema,
};

// ============================================================================
// DISPUTES
// ============================================================================

export const listDisputesSchema = z.object({
    query: z.object({
        ...paginationQuery,
        ...dateRangeQuery,
        status: z.enum(['open', 'under_review', 'evidence_submitted', 'won', 'lost', 'closed']).optional(),
        disputeType: z.string().optional(),
        search: z.string().optional(),
    }),
});

export const disputeParamsSchema = z.object({
    params: z.object({ ...idParams }),
});

export const updateDisputeSchema = z.object({
    params: z.object({ ...idParams }),
    body: z.object({
        status: z.enum(['open', 'under_review', 'evidence_submitted', 'won', 'lost', 'closed']),
        resolutionNotes: z.string().optional(),
        amountDeducted: z.number().min(0).optional(),
    }),
});

// ============================================================================
// GST LEDGER
// ============================================================================

export const listGstSchema = z.object({
    query: z.object({
        ...paginationQuery,
        ...dateRangeQuery,
        isFiled: z.string().optional(),
        hsnCode: z.string().optional(),
        transactionType: z.string().optional(),
    }),
});

export const markGstFiledSchema = z.object({
    body: z.object({
        ids: z.array(uuidSchema).min(1).max(500),
        returnPeriod: z.string().min(1),
    }),
});

// ============================================================================
// FINANCIAL LEDGER
// ============================================================================

export const listLedgerSchema = z.object({
    query: z.object({
        ...paginationQuery,
        ...dateRangeQuery,
        accountType: z.string().optional(),
        entryType: z.enum(['credit', 'debit']).optional(),
        referenceType: z.string().optional(),
    }),
});

// ============================================================================
// RECONCILIATION
// ============================================================================

export const listReconSchema = z.object({
    query: z.object({
        ...paginationQuery,
        ...dateRangeQuery,
        status: z.enum(['pending', 'matched', 'mismatched', 'resolved', 'write_off']).optional(),
        gatewayProvider: z.string().optional(),
    }),
});

export const reconParamsSchema = z.object({
    params: z.object({ ...idParams }),
});

export const resolveReconSchema = z.object({
    params: z.object({ ...idParams }),
    body: z.object({
        notes: z.string().min(1).max(1000),
    }),
});

// ============================================================================
// HOLD FUNDS
// ============================================================================

export const listHoldFundsSchema = z.object({
    query: z.object({
        ...paginationQuery,
        ...dateRangeQuery,
        isActive: z.string().optional(),
        entityType: z.string().optional(),
    }),
});

export const holdFundParamsSchema = z.object({
    params: z.object({ ...idParams }),
});

export const releaseHoldFundSchema = z.object({
    params: z.object({ ...idParams }),
    body: z.object({
        reason: z.string().min(1).max(1000),
    }),
});

// ============================================================================
// COMMISSION SLABS
// ============================================================================

export const createCommissionSlabSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        minMonthlyRevenue: z.number().min(0),
        maxMonthlyRevenue: z.number().min(0).optional(),
        consultationCommissionPercent: z.number().min(0).max(100),
        medicineCommissionPercent: z.number().min(0).max(100),
    }),
});

export const updateCommissionSlabSchema = z.object({
    params: z.object({ ...idParams }),
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(500).optional(),
        minMonthlyRevenue: z.number().min(0).optional(),
        maxMonthlyRevenue: z.number().min(0).nullable().optional(),
        consultationCommissionPercent: z.number().min(0).max(100).optional(),
        medicineCommissionPercent: z.number().min(0).max(100).optional(),
    }),
});

export const commissionSlabParamsSchema = z.object({
    params: z.object({ ...idParams }),
});

export const toggleCommissionSlabSchema = z.object({
    params: z.object({ ...idParams }),
    body: z.object({
        isActive: z.boolean(),
    }),
});
