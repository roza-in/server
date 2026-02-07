// ============================================================================
// Refund Module Types
// ============================================================================

export type RefundType = 'full' | 'partial_75' | 'partial_50' | 'none' | 'doctor_cancelled' | 'technical_failure';
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Refund {
    id: string;
    payment_id: string;
    appointment_id: string;
    patient_id: string;
    refund_type: RefundType;
    refund_percentage: number;
    original_amount: number;
    refund_amount: number;
    platform_fee_refund: number;
    razorpay_refund_id: string | null;
    status: RefundStatus;
    reason: string | null;
    cancelled_by: string | null;
    requested_at: string;
    processed_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    credit_amount: number | null;
    created_at: string;
    updated_at: string;
}

export interface RefundFilters {
    status?: RefundStatus;
    patientId?: string;
    appointmentId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface RefundListResponse {
    refunds: Refund[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProcessRefundInput {
    action: 'approve' | 'reject';
    notes?: string;
}

export interface CreateRefundInput {
    payment_id: string;
    refund_type: RefundType;
    reason: string;
}

