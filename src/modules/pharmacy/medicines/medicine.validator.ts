/**
 * Medicine Module Validators
 * Zod schemas for input validation
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import { z } from 'zod';

// ============================================================================
// Medicine Search
// ============================================================================

export const searchMedicinesSchema = z.object({
    query: z.object({
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
    }),
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
    body: z.object({
        prescriptionId: z.string().uuid().optional(),
        deliveryAddress: deliveryAddressSchema,
        items: z.array(orderItemSchema).min(1).max(50),
        familyMemberId: z.string().uuid().optional(),
        couponCode: z.string().max(20).optional(),
        idempotencyKey: z.string().max(64).optional(),
    }),
});

// ============================================================================
// Order Management
// ============================================================================

export const confirmOrderSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        estimatedReadyTime: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
    }),
});

export const updateOrderStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        status: z.enum([
            'confirmed', 'processing', 'packed', 'ready_for_pickup',
            'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned',
        ]),
        notes: z.string().max(500).optional(),
        deliveryPartner: z.string().max(100).optional(),
        trackingId: z.string().max(100).optional(),
        trackingUrl: z.string().url().optional(),
        otp: z.string().length(6).optional(),
    }),
});

export const cancelOrderSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        reason: z.string().min(5).max(500),
    }),
});

// ============================================================================
// List Orders
// ============================================================================

export const listOrdersSchema = z.object({
    query: z.object({
        status: z.enum([
            'pending', 'confirmed', 'processing', 'packed', 'ready_for_pickup',
            'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned',
        ]).optional(),
        fromDate: z.string().date().optional(),
        toDate: z.string().date().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

// ============================================================================
// Prescription → Order Flow
// ============================================================================

export const createOrderFromPrescriptionSchema = z.object({
    body: z.object({
        prescriptionId: z.string().uuid(),
        deliveryAddress: deliveryAddressSchema,
        selectedMedicineIds: z.array(z.string().uuid()).optional(),
    }),
});

// ============================================================================
// Returns
// ============================================================================

export const createReturnSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        reason: z.string().min(5).max(500),
        reason_details: z.string().max(1000).optional(),
        items: z.array(z.object({
            medicineId: z.string().uuid(),
            quantity: z.number().int().min(1),
            reason: z.string().max(500).optional(),
        })).optional(),
        photos: z.array(z.string().url()).max(5).optional(),
        refund_amount: z.number().min(0).optional(),
    }),
});

// ============================================================================
// Medicine CRUD (Pharmacy / Admin)
// ============================================================================

export const createMedicineSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(255),
        generic_name: z.string().max(255).optional(),
        sku: z.string().min(2).max(50),
        brand: z.string().max(255).optional(),
        manufacturer: z.string().max(255).optional(),
        category: z.string().optional(),
        schedule: z.enum(['otc', 'schedule_h', 'schedule_h1', 'schedule_x', 'ayurvedic', 'homeopathic']).optional(),
        composition: z.string().max(1000).optional(),
        strength: z.string().max(100).optional(),
        pack_size: z.string().max(100).optional(),
        mrp: z.number().min(0),
        selling_price: z.number().min(0),
        discount_percent: z.number().min(0).max(100).optional(),
        prescription_required: z.boolean().optional().default(false),
        stock_quantity: z.number().int().min(0).default(0),
        description: z.string().max(5000).optional(),
        image_url: z.string().url().optional(),
        hsn_code: z.string().max(20).optional(),
        gst_percent: z.number().min(0).max(100).optional(),
    }),
});

export const updateMedicineSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        name: z.string().min(2).max(255).optional(),
        generic_name: z.string().max(255).optional(),
        brand: z.string().max(255).optional(),
        manufacturer: z.string().max(255).optional(),
        category: z.string().optional(),
        schedule: z.enum(['otc', 'schedule_h', 'schedule_h1', 'schedule_x', 'ayurvedic', 'homeopathic']).optional(),
        composition: z.string().max(1000).optional(),
        strength: z.string().max(100).optional(),
        pack_size: z.string().max(100).optional(),
        mrp: z.number().min(0).optional(),
        selling_price: z.number().min(0).optional(),
        discount_percent: z.number().min(0).max(100).optional(),
        prescription_required: z.boolean().optional(),
        stock_quantity: z.number().int().min(0).optional(),
        description: z.string().max(5000).optional(),
        image_url: z.string().url().optional(),
        is_active: z.boolean().optional(),
    }),
});

export const deleteMedicineSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

// ============================================================================
// Exported Inferred Types
// ============================================================================

export type SearchMedicinesInput = z.infer<typeof searchMedicinesSchema>;
export type CreateMedicineOrderInput = z.infer<typeof createMedicineOrderSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type CreateOrderFromPrescriptionInput = z.infer<typeof createOrderFromPrescriptionSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CreateMedicineInput = z.infer<typeof createMedicineSchema>['body'];
export type UpdateMedicineInput = z.infer<typeof updateMedicineSchema>['body'];
