/**
 * Pharmacy Settlement Types
 * Type definitions for pharmacy-specific settlement management
 */

import type { PharmacySettlement, SettlementStatus } from '../../../types/database.types.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CalculatePharmacySettlementInput {
    hospitalId: string;
    periodStart: string;
    periodEnd: string;
}

export interface ProcessPharmacySettlementInput {
    paymentMode: string;
    utrNumber?: string;
}

export interface PharmacySettlementFilters {
    hospitalId?: string;
    status?: SettlementStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface PharmacySettlementWithDetails extends PharmacySettlement {
    hospital?: { id: string; name: string; slug: string | null };
}

export interface PharmacySettlementListResponse {
    settlements: PharmacySettlementWithDetails[];
    total: number;
}

export interface PharmacySettlementStats {
    totalSettlements: number;
    pendingSettlements: number;
    processingSettlements: number;
    completedSettlements: number;
    totalPayable: number;
    totalCommission: number;
    totalTds: number;
}
