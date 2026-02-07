/**
 * Medicine Module Validators
 * Zod schemas for input validation
 */

import { z } from 'zod';

// ============================================================================
// Medicine Search
// ============================================================================

export const searchMedicinesSchema = z.object({
    query: z.string().min(2).max(100).optional(),
    category: z.string().optional(),
    schedule: z.enum(['otc', 'schedule_h', 'schedule_h1', 'schedule_x', 'ayurvedic', 'homeopathic']).optional(),
    brand: z.string().optional(),
    manufacturer: z.string().optional(),
    prescriptionRequired: z.coerce.boolean().optional(),
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============================================================================
// Pharmacy Search
// ============================================================================

export const searchPharmaciesSchema = z.object({
    city: z.string().optional(),
    pincode: z.string().length(6).optional(),
    type: z.enum(['hospital_pharmacy', 'retail_pharmacy', 'chain_pharmacy', 'online_pharmacy']).optional(),
    homeDelivery: z.coerce.boolean().optional(),
    is24x7: z.coerce.boolean().optional(),
    nearbyLat: z.coerce.number().min(-90).max(90).optional(),
    nearbyLng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(1).max(50).default(10),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============================================================================
// Create Order
// ============================================================================

const deliveryAddressSchema = z.object({
    address: z.string().min(5).max(255),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    pincode: z.string().length(6),
    landmark: z.string().max(255).optional(),
    country: z.string().max(50).optional().default('India'),
    phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

const orderItemSchema = z.object({
    medicineId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    prescriptionItemIndex: z.number().int().min(0).optional(),
});

export const createMedicineOrderSchema = z.object({
    prescriptionId: z.string().uuid().optional(),
    fulfillmentType: z.enum(['platform_delivery', 'pharmacy_pickup', 'self_arrange', 'hospital_pharmacy']),
    pharmacyId: z.string().uuid().optional(),
    deliveryAddressId: z.string().uuid().optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
    items: z.array(orderItemSchema).min(1).max(50),
    familyMemberId: z.string().uuid().optional(),
    couponCode: z.string().max(20).optional(),
    idempotencyKey: z.string().max(64).optional(),
}).refine(
    (data) => {
        // For platform delivery, either address or addressId is required
        if (data.fulfillmentType === 'platform_delivery') {
            return data.deliveryAddress || data.deliveryAddressId;
        }
        return true;
    },
    { message: 'Delivery address is required for platform delivery' }
);

// ============================================================================
// Order Management
// ============================================================================

export const confirmOrderSchema = z.object({
    orderId: z.string().uuid(),
    estimatedReadyTime: z.string().datetime().optional(),
    pharmacyNotes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
    orderId: z.string().uuid(),
    status: z.enum([
        'pending', 'confirmed', 'processing', 'ready_for_pickup',
        'out_for_delivery', 'delivered', 'cancelled', 'returned', 'failed'
    ]),
    notes: z.string().max(500).optional(),
    trackingId: z.string().max(100).optional(),
    trackingUrl: z.string().url().optional(),
});

export const cancelOrderSchema = z.object({
    orderId: z.string().uuid(),
    reason: z.string().min(5).max(500),
});

// ============================================================================
// Pharmacy Inventory
// ============================================================================

export const updateInventorySchema = z.object({
    medicineId: z.string().uuid(),
    quantityAvailable: z.number().int().min(0),
    sellingPrice: z.number().min(0),
    discountPercent: z.number().min(0).max(100).optional(),
    batchNumber: z.string().max(50).optional(),
    expiryDate: z.string().date().optional(),
    isAvailable: z.boolean().optional(),
});

export const bulkUpdateInventorySchema = z.object({
    pharmacyId: z.string().uuid(),
    items: z.array(updateInventorySchema).min(1).max(500),
});

// ============================================================================
// Pharmacy Registration
// ============================================================================

export const registerPharmacySchema = z.object({
    name: z.string().min(3).max(255),
    type: z.enum(['hospital_pharmacy', 'retail_pharmacy', 'chain_pharmacy', 'online_pharmacy']),
    hospitalId: z.string().uuid().optional(),
    drugLicenseNumber: z.string().min(5).max(100),
    gstNumber: z.string().length(15).optional(),
    fssaiLicense: z.string().max(50).optional(),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    alternatePhone: z.string().regex(/^[6-9]\d{9}$/).optional(),
    email: z.string().email().optional(),
    address: z.string().min(5).max(255),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    pincode: z.string().length(6),
    landmark: z.string().max(255).optional(),
    country: z.string().max(50).optional().default('India'),
    location: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
    }).optional(),
    workingHours: z.record(z.string(), z.object({
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
    })).optional(),
    is24x7: z.boolean().default(false),
    homeDelivery: z.boolean().default(true),
    minOrderAmount: z.number().min(0).default(0),
    deliveryRadiusKm: z.number().min(1).max(50).default(10),
});

// ============================================================================
// Order Rating
// ============================================================================

export const rateOrderSchema = z.object({
    orderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
});

// ============================================================================
// List Orders
// ============================================================================

export const listOrdersSchema = z.object({
    status: z.enum([
        'pending', 'confirmed', 'processing', 'ready_for_pickup',
        'out_for_delivery', 'delivered', 'cancelled', 'returned', 'failed'
    ]).optional(),
    fulfillmentType: z.enum(['platform_delivery', 'pharmacy_pickup', 'self_arrange', 'hospital_pharmacy']).optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    pharmacyId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Export types
export type SearchMedicinesInput = z.infer<typeof searchMedicinesSchema>;
export type SearchPharmaciesInput = z.infer<typeof searchPharmaciesSchema>;
export type CreateMedicineOrderInput = z.infer<typeof createMedicineOrderSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type BulkUpdateInventoryInput = z.infer<typeof bulkUpdateInventorySchema>;
export type RegisterPharmacyInput = z.infer<typeof registerPharmacySchema>;
export type RateOrderInput = z.infer<typeof rateOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;

