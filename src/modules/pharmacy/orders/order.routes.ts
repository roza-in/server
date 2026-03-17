/**
 * Order Routes
 * Express routes for pharmacy order management
 * Aligned to migration 007 — centralized ROZX pharmacy model
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
    getHospitalOrders,
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
} from '../medicines/medicine.validator.js';

const router = Router();

// Rate limiting for order creation
const orderRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    prefix: 'medicine_order',
});

// ============================================================================
// Patient Routes — Orders
// ============================================================================

/**
 * @route   POST /
 * @desc    Create medicine order
 * @access  Patient
 */
router.post(
    '/',
    authMiddleware,
    orderRateLimit,
    validate(createMedicineOrderSchema),
    createOrder,
);

/**
 * @route   GET /
 * @desc    Get patient's orders
 * @access  Patient
 */
router.get('/', authMiddleware, validate(listOrdersSchema), getMyOrders);

/**
 * @route   GET /number/:orderNumber
 * @desc    Get order by order number
 * @access  Patient/Admin
 */
router.get('/number/:orderNumber', authMiddleware, getOrderByNumber);

/**
 * @route   GET /:id
 * @desc    Get order by ID
 * @access  Patient/Admin
 */
router.get('/:id', authMiddleware, getOrderById);

/**
 * @route   POST /:id/cancel
 * @desc    Cancel order
 * @access  Patient
 */
router.post(
    '/:id/cancel',
    authMiddleware,
    validate(cancelOrderSchema),
    cancelOrder,
);

// ============================================================================
// Hospital / Admin Routes — Order Management
// ============================================================================

/**
 * @route   GET /hospital/:hospitalId
 * @desc    Get hospital medicine orders
 * @access  Admin / Hospital Admin
 */
router.get(
    '/hospital/:hospitalId',
    authMiddleware,
    roleGuard('admin', 'hospital'),
    validate(listOrdersSchema),
    getHospitalOrders,
);

/**
 * @route   POST /:id/confirm
 * @desc    Confirm order
 * @access  Admin / Hospital Admin
 */
router.post(
    '/:id/confirm',
    authMiddleware,
    roleGuard('admin', 'hospital'),
    validate(confirmOrderSchema),
    confirmOrder,
);

/**
 * @route   PATCH /:id/status
 * @desc    Update order status
 * @access  Admin / Hospital Admin
 */
router.patch(
    '/:id/status',
    authMiddleware,
    roleGuard('admin', 'hospital'),
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

export const orderRoutes = router;
export default router;