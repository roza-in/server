/**
 * Pharmacy Order Types
 * Type definitions for medicine ordering system
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import type {
    MedicineOrder,
    MedicineOrderItem,
    MedicineOrderStatus,
} from '../../../types/database.types.js';

// Re-export from medicines types for consistency
export type {
    CreateMedicineOrderInput,
    CreateOrderItemInput,
    MedicineOrderWithDetails,
    MedicineOrderItemWithDetails,
    OrderPricingBreakdown,
    ConfirmOrderInput,
    UpdateOrderStatusInput,
    CancelOrderInput,
    MedicineOrderStats,
} from '../medicines/medicine.types.js';

// Re-export DB types
export type { MedicineOrder, MedicineOrderItem, MedicineOrderStatus };

// ============================================================================
// Order Listing Filters
// ============================================================================

export interface OrderListFilters {
    patientId?: string;
    hospitalId?: string;
    status?: MedicineOrderStatus;
    page?: number;
    limit?: number;
}

export interface OrderListResponse {
    orders: MedicineOrder[];
    total: number;
    page: number;
    limit: number;
}
