/**
 * Medicine Routes
 * Express routes for medicine e-commerce
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../../../middlewares/auth.middleware.js';
import { roleGuard } from '../../../middlewares/role.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { rateLimit } from '../../../middlewares/rate-limit.middleware.js';
import {
    searchMedicines,
    getMedicineById,
    createOrder,
    getMyOrders,
    getOrderById,
    getOrderByNumber,
    cancelOrder,
    getHospitalOrders,
    confirmOrder,
    updateOrderStatus,
    getOrderStats,
    mapPrescriptionMedicines,
    createOrderFromPrescription,
    getUnorderedPrescriptions,
    getDeliveryTracking,
    createReturn,
    getReturns,
    createMedicine,
    updateMedicine,
    deleteMedicine,
    listAllOrders,
} from './medicine.controller.js';
import {
    searchMedicinesSchema,
    createMedicineOrderSchema,
    cancelOrderSchema,
    confirmOrderSchema,
    updateOrderStatusSchema,
    listOrdersSchema,
    createOrderFromPrescriptionSchema,
    createReturnSchema,
    createMedicineSchema,
    updateMedicineSchema,
    deleteMedicineSchema,
} from './medicine.validator.js';

const router = Router();

// Rate limiting for order creation
const orderRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    prefix: 'medicine_order',
});

// ============================================================================
// Public Routes — Medicine Catalog
// ============================================================================

/**
 * @route   GET /
 * @desc    Search medicines catalog
 * @access  Public
 */
router.get('/', optionalAuth, validate(searchMedicinesSchema), searchMedicines);

/**
 * @route   GET /:id
 * @desc    Get medicine by ID
 * @access  Public
 */
router.get('/:id', optionalAuth, getMedicineById);

// ============================================================================
// Patient Routes — Orders
// ============================================================================

/**
 * @route   POST /orders
 * @desc    Create medicine order
 * @access  Patient
 */
router.post(
    '/orders',
    authMiddleware,
    orderRateLimit,
    validate(createMedicineOrderSchema),
    createOrder,
);

/**
 * @route   GET /orders
 * @desc    Get patient's orders
 * @access  Patient
 */
router.get('/orders', authMiddleware, validate(listOrdersSchema), getMyOrders);

/**
 * @route   GET /orders/number/:orderNumber
 * @desc    Get order by order number
 * @access  Patient/Admin
 */
router.get('/orders/number/:orderNumber', authMiddleware, getOrderByNumber);

/**
 * @route   GET /orders/:id
 * @desc    Get order by ID
 * @access  Patient/Admin
 */
router.get('/orders/:id', authMiddleware, getOrderById);

/**
 * @route   POST /orders/:id/cancel
 * @desc    Cancel order
 * @access  Patient
 */
router.post(
    '/orders/:id/cancel',
    authMiddleware,
    validate(cancelOrderSchema),
    cancelOrder,
);

// ============================================================================
// Hospital / Admin Routes — Order Management
// ============================================================================

/**
 * @route   GET /hospital/:hospitalId/orders
 * @desc    Get hospital medicine orders
 * @access  Admin / Hospital Admin
 */
router.get(
    '/hospital/:hospitalId/orders',
    authMiddleware,
    roleGuard('admin', 'hospital', 'pharmacy'),
    validate(listOrdersSchema),
    getHospitalOrders,
);

/**
 * @route   POST /orders/:id/confirm
 * @desc    Confirm order
 * @access  Admin / Hospital Admin
 */
router.post(
    '/orders/:id/confirm',
    authMiddleware,
    roleGuard('admin', 'hospital', 'pharmacy'),
    validate(confirmOrderSchema),
    confirmOrder,
);

/**
 * @route   PATCH /orders/:id/status
 * @desc    Update order status
 * @access  Admin / Hospital Admin
 */
router.patch(
    '/orders/:id/status',
    authMiddleware,
    roleGuard('admin', 'hospital', 'pharmacy'),
    validate(updateOrderStatusSchema),
    updateOrderStatus,
);

// ============================================================================
// Analytics
// ============================================================================

/**
 * @route   GET /stats
 * @desc    Get order statistics
 * @access  Authenticated
 */
router.get('/stats', authMiddleware, getOrderStats);

/**
 * @route   GET /hospital/:hospitalId/stats
 * @desc    Get hospital medicine order statistics
 * @access  Admin / Hospital Admin
 */
router.get('/hospital/:hospitalId/stats', authMiddleware, roleGuard('admin', 'hospital'), getOrderStats);

// ============================================================================
// Prescription → Order Flow
// ============================================================================

/**
 * @route   GET /prescriptions/unordered
 * @desc    Get patient prescriptions that haven't been ordered yet
 * @access  Patient
 */
router.get('/prescriptions/unordered', authMiddleware, getUnorderedPrescriptions);

/**
 * @route   GET /prescriptions/:prescriptionId/medicines
 * @desc    Map prescription medications to catalog medicines
 * @access  Patient
 */
router.get('/prescriptions/:prescriptionId/medicines', authMiddleware, mapPrescriptionMedicines);

/**
 * @route   POST /orders/from-prescription
 * @desc    Create order directly from a prescription
 * @access  Patient
 */
router.post(
    '/orders/from-prescription',
    authMiddleware,
    orderRateLimit,
    validate(createOrderFromPrescriptionSchema),
    createOrderFromPrescription,
);

// ============================================================================
// Delivery Tracking & Returns
// ============================================================================

/**
 * @route   GET /orders/:id/tracking
 * @desc    Get delivery tracking events for an order
 * @access  Patient/Admin
 */
router.get('/orders/:id/tracking', authMiddleware, getDeliveryTracking);

/**
 * @route   POST /orders/:id/return
 * @desc    Create a return request for a delivered order
 * @access  Patient
 */
router.post(
    '/orders/:id/return',
    authMiddleware,
    validate(createReturnSchema),
    createReturn,
);

/**
 * @route   GET /orders/:id/returns
 * @desc    Get returns for an order
 * @access  Patient/Admin
 */
router.get('/orders/:id/returns', authMiddleware, getReturns);

// ============================================================================
// Medicine CRUD — Pharmacy / Admin
// ============================================================================

/**
 * @route   POST /manage
 * @desc    Create new medicine
 * @access  Pharmacy / Admin
 */
router.post(
    '/manage',
    authMiddleware,
    roleGuard('admin', 'pharmacy'),
    validate(createMedicineSchema),
    createMedicine,
);

/**
 * @route   PUT /manage/:id
 * @desc    Update medicine
 * @access  Pharmacy / Admin
 */
router.put(
    '/manage/:id',
    authMiddleware,
    roleGuard('admin', 'pharmacy'),
    validate(updateMedicineSchema),
    updateMedicine,
);

/**
 * @route   DELETE /manage/:id
 * @desc    Soft-delete (deactivate) medicine
 * @access  Pharmacy / Admin
 */
router.delete(
    '/manage/:id',
    authMiddleware,
    roleGuard('admin', 'pharmacy'),
    validate(deleteMedicineSchema),
    deleteMedicine,
);

/**
 * @route   GET /all-orders
 * @desc    List all orders (pharmacy dashboard)
 * @access  Pharmacy / Admin
 */
router.get(
    '/all-orders',
    authMiddleware,
    roleGuard('admin', 'pharmacy'),
    validate(listOrdersSchema),
    listAllOrders,
);

export const medicineRoutes = router;
export default router;
