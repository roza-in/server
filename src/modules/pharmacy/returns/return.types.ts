/**
 * Medicine Return Types
 * Type definitions for medicine return/refund flow
 */

import type { MedicineReturn, MedicineOrder } from '../../../types/database.types.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateReturnInput {
    reason: string;
    reasonDetails?: string;
    items: {
        medicineId: string;
        quantity: number;
        reason?: string;
    }[];
    photos?: string[];
    refundAmount?: number;
}

export interface ReviewReturnInput {
    status: 'approved' | 'rejected';
    reviewNotes?: string;
    refundAmount?: number;
    schedulePickup?: boolean;
}

export interface ReturnFilters {
    orderId?: string;
    status?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface MedicineReturnWithDetails extends MedicineReturn {
    order?: MedicineOrder;
    patient?: { id: string; name: string; phone: string | null; email: string | null };
}

export interface ReturnListResponse {
    returns: MedicineReturnWithDetails[];
    total: number;
}

export interface ReturnStats {
    totalReturns: number;
    pendingReturns: number;
    approvedReturns: number;
    rejectedReturns: number;
    totalRefundAmount: number;
}
