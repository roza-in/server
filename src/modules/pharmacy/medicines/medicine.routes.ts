/**
 * Medicine Routes
 * Express routes for medicine e-commerce
 */

import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../../../middlewares/auth.middleware.js';
import { roleGuard } from '../../../middlewares/role.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { rateLimit } from '../../../middlewares/rate-limit.middleware.js';
import {
    searchMedicines,
    getMedicineById,
    searchPharmacies,
    getPharmacyById,
    createOrder,
    getMyOrders,
    getOrderById,
    getOrderByNumber,
    cancelOrder,
    getPharmacyOrders,
    confirmOrder,
    updateOrderStatus,
    getOrderStats,
} from './medicine.controller.js';
import {
    searchMedicinesSchema,
    searchPharmaciesSchema,
    createMedicineOrderSchema,
    cancelOrderSchema,
    confirmOrderSchema,
    updateOrderStatusSchema,
    listOrdersSchema,
} from './medicine.validator.js';

const router = Router();

// Rate limiting for order creation
const orderRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    prefix: 'medicine_order',
});

// ============================================================================
// Public Routes - Medicine Catalog
// ============================================================================

/**
 * @route   GET /medicines
 * @desc    Search medicines catalog
 * @access  Public
 */
router.get('/', optionalAuth, validate(searchMedicinesSchema), searchMedicines);

/**
 * @route   GET /medicines/:id
 * @desc    Get medicine by ID
 * @access  Public
 */
router.get('/:id', optionalAuth, getMedicineById);

// ============================================================================
// Public Routes - Pharmacy Search
// ============================================================================

/**
 * @route   GET /pharmacies
 * @desc    Search pharmacies
 * @access  Public
 */
router.get('/pharmacies', optionalAuth, validate(searchPharmaciesSchema), searchPharmacies);

/**
 * @route   GET /pharmacies/:id
 * @desc    Get pharmacy by ID
 * @access  Public
 */
router.get('/pharmacies/:id', optionalAuth, getPharmacyById);

// ============================================================================
// Patient Routes - Orders
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
    createOrder
);

/**
 * @route   GET /orders
 * @desc    Get patient's orders
 * @access  Patient
 */
router.get('/orders', authMiddleware, validate(listOrdersSchema), getMyOrders);

/**
 * @route   GET /orders/:id
 * @desc    Get order by ID
 * @access  Patient/Pharmacy
 */
router.get('/orders/:id', authMiddleware, getOrderById);

/**
 * @route   GET /orders/number/:orderNumber
 * @desc    Get order by order number
 * @access  Patient/Pharmacy
 */
router.get('/orders/number/:orderNumber', authMiddleware, getOrderByNumber);

/**
 * @route   POST /orders/:id/cancel
 * @desc    Cancel order
 * @access  Patient
 */
router.post(
    '/orders/:id/cancel',
    authMiddleware,
    validate(cancelOrderSchema),
    cancelOrder
);

// ============================================================================
// Pharmacy Routes - Order Management
// ============================================================================

/**
 * @route   GET /pharmacy/:pharmacyId/orders
 * @desc    Get pharmacy orders
 * @access  Pharmacy Owner
 */
router.get(
    '/pharmacy/:pharmacyId/orders',
    authMiddleware,
    roleGuard('pharmacy', 'admin'),
    validate(listOrdersSchema),
    getPharmacyOrders
);

/**
 * @route   POST /orders/:id/confirm
 * @desc    Confirm order (pharmacy)
 * @access  Pharmacy Owner
 */
router.post(
    '/orders/:id/confirm',
    authMiddleware,
    roleGuard('pharmacy', 'admin'),
    validate(confirmOrderSchema),
    confirmOrder
);

/**
 * @route   PATCH /orders/:id/status
 * @desc    Update order status
 * @access  Pharmacy Owner
 */
router.patch(
    '/orders/:id/status',
    authMiddleware,
    roleGuard('pharmacy', 'admin'),
    validate(updateOrderStatusSchema),
    updateOrderStatus
);

// ============================================================================
// Analytics
// ============================================================================

/**
 * @route   GET /stats
 * @desc    Get order statistics
 * @access  Patient/Pharmacy
 */
router.get('/stats', authMiddleware, getOrderStats);

/**
 * @route   GET /pharmacy/:pharmacyId/stats
 * @desc    Get pharmacy statistics
 * @access  Pharmacy Owner
 */
router.get('/pharmacy/:pharmacyId/stats', authMiddleware, roleGuard('pharmacy', 'admin'), getOrderStats);

export const medicineRoutes = router;
export default router;

