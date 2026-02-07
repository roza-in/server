/**
 * Order Controller
 * HTTP handlers for pharmacy order management
 */

import { Request, Response } from 'express';
import { orderService } from './order.service.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../../common/responses/index.js';
import { asyncHandler } from '../../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.js';

// ============================================================================
// Order Management - Patient
// ============================================================================

/**
 * Create medicine order
 * POST /api/v1/pharmacy/orders
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.createOrder(user.userId, req.body);
    return sendCreated(res, order, 'Order created successfully');
});

/**
 * Get patient's orders
 * GET /api/v1/pharmacy/orders
 */
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await orderService.listPatientOrders(user.userId, {
        status: req.query.status as any,
        page,
        limit,
    });
    return sendPaginated(
        res,
        result.orders,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get order by ID
 * GET /api/v1/pharmacy/orders/:id
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.getOrderById(req.params.id, user.userId, user.role);
    return sendSuccess(res, order);
});

/**
 * Get order by order number
 * GET /api/v1/pharmacy/orders/number/:orderNumber
 */
export const getOrderByNumber = asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getOrderByNumber(req.params.orderNumber);
    return sendSuccess(res, order);
});

/**
 * Cancel order
 * POST /api/v1/pharmacy/orders/:id/cancel
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.cancelOrder(
        user.userId,
        req.params.id,
        req.body.reason
    );
    return sendSuccess(res, order, 'Order cancelled successfully');
});

// ============================================================================
// Order Management - Pharmacy
// ============================================================================

/**
 * Get pharmacy orders
 * GET /api/v1/pharmacy/pharmacy/:pharmacyId/orders
 */
export const getPharmacyOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await orderService.listPharmacyOrders(req.params.pharmacyId, {
        status: req.query.status as any,
        page,
        limit,
    });
    return sendPaginated(
        res,
        result.orders,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Confirm order (pharmacy)
 * POST /api/v1/pharmacy/orders/:id/confirm
 */
export const confirmOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await orderService.confirmOrder(
        user.userId,
        req.params.id,
        req.body.estimatedReadyTime,
        req.body.notes
    );
    return sendSuccess(res, order, 'Order confirmed successfully');
});

/**
 * Update order status
 * PATCH /api/v1/pharmacy/orders/:id/status
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    let order;

    switch (req.body.status) {
        case 'processing':
            order = await orderService.markAsProcessing(user.userId, req.params.id);
            break;
        case 'ready_for_pickup':
            order = await orderService.markAsReady(user.userId, req.params.id);
            break;
        case 'out_for_delivery':
            order = await orderService.dispatchOrder(
                user.userId,
                req.params.id,
                req.body.deliveryPartnerId,
                req.body.trackingId
            );
            break;
        case 'delivered':
            order = await orderService.completeDelivery(req.params.id, req.body.otp);
            break;
        default:
            throw new Error('Invalid status transition');
    }

    return sendSuccess(res, order, 'Order status updated successfully');
});

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get order statistics
 * GET /api/v1/pharmacy/stats
 */
export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user.role === 'patient' ? 'patient' : 'pharmacy';
    const stats = await orderService.getOrderStats(
        user.userId,
        role as any,
        req.params.pharmacyId
    );
    return sendSuccess(res, stats);
});
