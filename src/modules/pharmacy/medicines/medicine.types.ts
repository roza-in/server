/**
 * Medicine Module Types
 * Type definitions for the medicine e-commerce system
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import type {
    Medicine,
    MedicineOrder,
    MedicineOrderItem,
    MedicineOrderStatus,
} from '../../../types/database.types.js';

// Re-export for convenience
export type { Medicine, MedicineOrder, MedicineOrderItem, MedicineOrderStatus };

// ============================================================================
// Medicine Search & Listing
// ============================================================================

export interface MedicineSearchFilters {
    query?: string;
    category?: string;
    schedule?: string;
    brand?: string;
    manufacturer?: string;
    prescriptionRequired?: boolean;
    priceMin?: number;
    priceMax?: number;
    page?: number;
    limit?: number;
}

export interface MedicineSearchResponse {
    medicines: Medicine[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// ============================================================================
// Order Types
// ============================================================================

export interface CreateMedicineOrderInput {
    prescriptionId?: string;
    deliveryAddress?: {
        address: string;
        city: string;
        state: string;
        pincode: string;
        landmark?: string;
        country?: string;
        phone?: string;
        lat?: number;
        lng?: number;
    };
    items: CreateOrderItemInput[];
    familyMemberId?: string;
    couponCode?: string;
    idempotencyKey?: string;
    hospitalId?: string;
}

export interface CreateOrderItemInput {
    medicineId: string;
    quantity: number;
    prescriptionItemIndex?: number;
}

/**
 * Order with joined relations from Supabase query.
 * NOT an extends of MedicineOrder because the join returns nested objects.
 */
export interface MedicineOrderWithDetails extends MedicineOrder {
    medicine_order_items?: MedicineOrderItemWithDetails[];
    patient?: { id: string; name: string; phone: string | null; email: string | null };
    hospital?: { id: string; name: string } | null;
    prescription?: any;
    tracking_events?: any[];
}

export interface MedicineOrderItemWithDetails extends MedicineOrderItem {
    medicine?: { name: string; generic_name: string | null; image_url: string | null };
}

export interface OrderPricingBreakdown {
    subtotal: number;
    discountAmount: number;
    deliveryFee: number;
    gstAmount: number;
    totalAmount: number;
    hospitalCommission: number;
    platformCommission: number;
}

// ============================================================================
// Order Actions
// ============================================================================

export interface ConfirmOrderInput {
    orderId: string;
    estimatedReadyTime?: string;
    notes?: string;
}

export interface UpdateOrderStatusInput {
    orderId: string;
    status: MedicineOrderStatus;
    notes?: string;
    trackingId?: string;
    trackingUrl?: string;
}

export interface CancelOrderInput {
    orderId: string;
    reason: string;
}

// ============================================================================
// Prescription to Order Mapping
// ============================================================================

export interface PrescriptionToOrderMapping {
    prescriptionId: string;
    patientId: string;
    medicines: {
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        matchedMedicineId?: string;
        matchedMedicineName?: string;
        matchConfidence?: number;
        alternatives?: {
            id: string;
            name: string;
            mrp: number;
            isGeneric: boolean;
        }[];
    }[];
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface MedicineOrderStats {
    totalOrders: number;
    pendingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    platformCommission: number;
    averageOrderValue: number;
}

