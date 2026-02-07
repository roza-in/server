// ============================================================================
// Settlement Module Types (Hospital Payouts)
// ============================================================================

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Settlement {
    id: string;
    hospital_id: string;
    settlement_period_start: string;
    settlement_period_end: string;
    total_consultations: number;
    total_revenue: number;
    total_platform_fees: number;
    total_gst: number;
    total_refunds: number;
    net_settlement: number;
    bank_reference: string | null;
    transfer_id: string | null;
    status: SettlementStatus;
    calculated_at: string;
    initiated_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    invoice_number: string | null;
    invoice_url: string | null;
    payment_breakdown: any;
    created_at: string;
    updated_at: string;
}

export interface SettlementFilters {
    hospitalId?: string;
    status?: SettlementStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface SettlementListResponse {
    settlements: Settlement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateSettlementInput {
    hospital_id: string;
    period_start: string;
    period_end: string;
}

