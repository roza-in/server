// ============================================================================
// Refund Module Types
// Re-exports canonical Refund from database.types.ts
// ============================================================================

import type { Refund as DBRefund, RefundReason, RefundStatus } from '../../types/database.types.js';

/** Canonical Refund type from DB */
export type Refund = DBRefund;

/** Re-export enums for convenience */
export type { RefundReason, RefundStatus };

/** Refund with joined relations */
export interface RefundWithRelations extends Refund {
    payments?: {
        id: string;
        payment_number: string | null;
        payer_user_id: string;
        appointment_id: string | null;
        total_amount: number;
        base_amount: number;
        platform_fee: number;
        payment_method: string;
        status: string;
    } | null;
}

/** Filters for listing refunds */
export interface RefundFilters {
    payment_id?: string;
    status?: RefundStatus;
    reason?: RefundReason;
    initiated_by?: string;
    page?: number;
    limit?: number;
}

/** Input for creating a refund */
export interface CreateRefundInput {
    payment_id: string;
    refund_amount: number;
    reason: RefundReason;
    reason_details?: string;
    cancellation_fee?: number;
    policy_applied?: string;
}

/** Input for processing (approve/reject) a refund */
export interface ProcessRefundInput {
    action: 'approve' | 'reject';
    notes?: string;
}

/** Refund stats (computed) */
export interface RefundStats {
    totalRefunds: number;
    pendingAmount: number;
    completedAmount: number;
    pendingCount: number;
    completedCount: number;
}
