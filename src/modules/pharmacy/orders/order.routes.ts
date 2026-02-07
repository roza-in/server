/**
 * Order Routes
 * Express routes for pharmacy order management
 */

import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware.js';
import { roleGuard } from '../../../middlewares/role.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { rateLimit } from '../../../middlewares/rate-limit.middleware.js';
import {
    createOrder,
    getMyOrders,
    getOrderById,
    getOrderByNumber,
    cancelOrder,
    getPharmacyOrders,
    confirmOrder,
    updateOrderStatus,
    getOrderStats,
} from './order.controller.js';
import {
    createMedicineOrderSchema,
    cancelOrderSchema,
    confirmOrderSchema,
    updateOrderStatusSchema,
    listOrdersSchema,
} from '../medicines/medicine.validator.js'; // Reusing validators for now

const router = Router();

// Rate limiting for order creation
const orderRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    prefix: 'medicine_order',
});

// ============================================================================
// Patient Routes - Orders
// ============================================================================

/**
 * @route   POST /api/v1/pharmacy/orders
 * @desc    Create medicine order
 * @access  Patient
 */
router.post(
    '/',
    authMiddleware,
    orderRateLimit,
    validate(createMedicineOrderSchema),
    createOrder
);

/**
 * @route   GET /api/v1/pharmacy/orders
 * @desc    Get patient's orders
 * @access  Patient
 */
router.get('/', authMiddleware, validate(listOrdersSchema), getMyOrders);

/**
 * @route   GET /api/v1/pharmacy/orders/:id
 * @desc    Get order by ID
 * @access  Patient/Pharmacy
 */
router.get('/:id', authMiddleware, getOrderById);

/**
 * @route   GET /api/v1/pharmacy/orders/number/:orderNumber
 * @desc    Get order by order number
 * @access  Patient/Pharmacy
 */
router.get('/number/:orderNumber', authMiddleware, getOrderByNumber);

/**
 * @route   POST /api/v1/pharmacy/orders/:id/cancel
 * @desc    Cancel order
 * @access  Patient
 */
router.post(
    '/:id/cancel',
    authMiddleware,
    validate(cancelOrderSchema),
    cancelOrder
);

// ============================================================================
// Pharmacy Routes - Order Management
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/pharmacy/:pharmacyId/orders
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
 * @route   POST /api/v1/pharmacy/orders/:id/confirm
 * @desc    Confirm order (pharmacy)
 * @access  Pharmacy Owner
 */
router.post(
    '/:id/confirm',
    authMiddleware,
    roleGuard('pharmacy', 'admin'),
    validate(confirmOrderSchema),
    confirmOrder
);

/**
 * @route   PATCH /api/v1/pharmacy/orders/:id/status
 * @desc    Update order status
 * @access  Pharmacy Owner
 */
router.patch(
    '/:id/status',
    authMiddleware,
    roleGuard('pharmacy', 'admin'),
    validate(updateOrderStatusSchema),
    updateOrderStatus
);

// ============================================================================
// Analytics
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/stats
 * @desc    Get order statistics
 * @access  Patient/Pharmacy
 */
router.get('/stats', authMiddleware, getOrderStats);

/**
 * @route   GET /api/v1/pharmacy/pharmacy/:pharmacyId/stats
 * @desc    Get pharmacy statistics
 * @access  Pharmacy Owner
 */
router.get('/pharmacy/:pharmacyId/stats', authMiddleware, roleGuard('pharmacy', 'admin'), getOrderStats);

export const orderRoutes = router;
export default router;
