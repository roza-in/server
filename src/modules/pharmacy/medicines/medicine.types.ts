/**
 * Medicine Module Types
 * Type definitions for the medicine e-commerce system
 */

import type {
    Medicine,
    Pharmacy,
    MedicineOrder,
    MedicineOrderItem,
    DeliveryPartner,
    PharmacyInventory,
    FulfillmentType,
    MedicineOrderStatus
} from '../../../types/database.types.js';

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

export interface MedicineWithInventory extends Medicine {
    pharmacy_price?: number;
    pharmacy_discount?: number;
    available_count?: number;
    pharmacies_count?: number;
}

export interface MedicineSearchResponse {
    medicines: MedicineWithInventory[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// ============================================================================
// Pharmacy Types
// ============================================================================

export interface PharmacySearchFilters {
    city?: string;
    pincode?: string;
    type?: string;
    homeDelivery?: boolean;
    is24x7?: boolean;
    nearbyLat?: number;
    nearbyLng?: number;
    radiusKm?: number;
    page?: number;
    limit?: number;
}

export interface PharmacyWithDistance extends Pharmacy {
    distance_km?: number;
    has_all_medicines?: boolean;
    available_medicines_count?: number;
}

export interface PharmacySearchResponse {
    pharmacies: PharmacyWithDistance[];
    total: number;
    page: number;
    limit: number;
}

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
// Inventory Types
// ============================================================================

export interface InventoryUpdateInput {
    medicineId: string;
    quantityAvailable: number;
    sellingPrice: number;
    discountPercent?: number;
    batchNumber?: string;
    expiryDate?: string;
    isAvailable?: boolean;
}

export interface BulkInventoryUpdateInput {
    pharmacyId: string;
    items: InventoryUpdateInput[];
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
    suggestedPharmacies: PharmacyWithDistance[];
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

export interface PharmacyDashboardStats {
    todayOrders: number;
    todayRevenue: number;
    pendingOrders: number;
    processingOrders: number;
    readyForPickup: number;
    outForDelivery: number;
    averageProcessingTime: number;
    rating: number;
    totalRatings: number;
}

