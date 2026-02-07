/**
 * Pharmacy Order Types
 * Type definitions for medicine ordering system
 */

import type {
    Medicine,
    Pharmacy,
    MedicineOrder,
    MedicineOrderItem,
    DeliveryPartner,
    FulfillmentType,
    MedicineOrderStatus
} from '../../../types/database.types.js';

// ============================================================================
// Order Types
// ============================================================================

export interface CreateMedicineOrderInput {
    prescriptionId?: string;
    fulfillmentType: FulfillmentType;
    pharmacyId?: string;
    deliveryAddressId?: string;  // Use saved address
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
}

export interface CreateOrderItemInput {
    medicineId: string;
    quantity: number;
    prescriptionItemIndex?: number;  // Links to prescription.medications[index]
}

export interface MedicineOrderWithDetails extends MedicineOrder {
    items: MedicineOrderItemWithDetails[];
    pharmacy?: Pharmacy;
    delivery_partner?: DeliveryPartner;
    prescription?: any;  // Include prescription details if linked
    tracking_events?: any[];
}

export interface MedicineOrderItemWithDetails extends MedicineOrderItem {
    medicine: Medicine;
}

export interface OrderPricingBreakdown {
    subtotal: number;
    discountAmount: number;
    deliveryFee: number;
    platformFee: number;
    gstAmount: number;
    totalAmount: number;
    pharmacyAmount: number;
    platformCommission: number;
}

// ============================================================================
// Order Actions
// ============================================================================

export interface ConfirmOrderInput {
    orderId: string;
    estimatedReadyTime?: string;
    pharmacyNotes?: string;
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
    ordersByStatus: Record<MedicineOrderStatus, number>;
    ordersByFulfillmentType: Record<FulfillmentType, number>;
}
