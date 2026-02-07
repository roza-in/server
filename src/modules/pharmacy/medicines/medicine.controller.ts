/**
 * Medicine Controller
 * HTTP handlers for medicine e-commerce routes
 */

import { Request, Response } from 'express';
import { medicineService } from './medicine.service.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../../common/responses/index.js';
import { asyncHandler } from '../../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.js';

// ============================================================================
// Medicine Search
// ============================================================================

/**
 * Search medicines
 * GET /api/v1/medicines
 */
export const searchMedicines = asyncHandler(async (req: Request, res: Response) => {
    const result = await medicineService.searchMedicines({
        query: req.query.query as string,
        category: req.query.category as string,
        schedule: req.query.schedule as string,
        brand: req.query.brand as string,
        priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    return sendPaginated(
        res,
        result.medicines,
        calculatePagination(result.total, result.page, result.limit)
    );
});

/**
 * Get medicine by ID
 * GET /api/v1/medicines/:id
 */
export const getMedicineById = asyncHandler(async (req: Request, res: Response) => {
    const medicine = await medicineService.getMedicineById(req.params.id);
    return sendSuccess(res, medicine);
});

// ============================================================================
// Pharmacy Search
// ============================================================================

/**
 * Search pharmacies
 * GET /api/v1/medicines/pharmacies
 */
export const searchPharmacies = asyncHandler(async (req: Request, res: Response) => {
    const result = await medicineService.searchPharmacies({
        city: req.query.city as string,
        pincode: req.query.pincode as string,
        type: req.query.type as string,
        homeDelivery: req.query.homeDelivery === 'true',
        is24x7: req.query.is24x7 === 'true',
        nearbyLat: req.query.nearbyLat ? parseFloat(req.query.nearbyLat as string) : undefined,
        nearbyLng: req.query.nearbyLng ? parseFloat(req.query.nearbyLng as string) : undefined,
        radiusKm: req.query.radiusKm ? parseInt(req.query.radiusKm as string) : 10,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    });
    return sendPaginated(
        res,
        result.pharmacies,
        calculatePagination(result.total, result.page, result.limit)
    );
});

/**
 * Get pharmacy by ID
 * GET /api/v1/medicines/pharmacies/:id
 */
export const getPharmacyById = asyncHandler(async (req: Request, res: Response) => {
    const pharmacy = await medicineService.getPharmacyById(req.params.id);
    return sendSuccess(res, pharmacy);
});

// ============================================================================
// Order Management - Patient
// ============================================================================

/**
 * Create medicine order
 * POST /api/v1/medicines/orders
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.createOrder(user.userId, req.body);
    return sendCreated(res, order, 'Order created successfully');
});

/**
 * Get patient's orders
 * GET /api/v1/medicines/orders
 */
export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await medicineService.listPatientOrders(user.userId, {
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
 * GET /api/v1/medicines/orders/:id
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.getOrderById(req.params.id, user.userId);
    return sendSuccess(res, order);
});

/**
 * Get order by order number
 * GET /api/v1/medicines/orders/number/:orderNumber
 */
export const getOrderByNumber = asyncHandler(async (req: Request, res: Response) => {
    const order = await medicineService.getOrderByNumber(req.params.orderNumber);
    return sendSuccess(res, order);
});

/**
 * Cancel order
 * POST /api/v1/medicines/orders/:id/cancel
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.cancelOrder(
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
 * GET /api/v1/medicines/pharmacy/:pharmacyId/orders
 */
export const getPharmacyOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await medicineService.listPharmacyOrders(req.params.pharmacyId, {
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
 * POST /api/v1/medicines/orders/:id/confirm
 */
export const confirmOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.confirmOrder(
        user.userId,
        req.params.id,
        req.body.estimatedReadyTime,
        req.body.notes
    );
    return sendSuccess(res, order, 'Order confirmed successfully');
});

/**
 * Update order status
 * PATCH /api/v1/medicines/orders/:id/status
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    let order;

    switch (req.body.status) {
        case 'processing':
            order = await medicineService.markAsProcessing(user.userId, req.params.id);
            break;
        case 'ready_for_pickup':
            order = await medicineService.markAsReady(user.userId, req.params.id);
            break;
        case 'out_for_delivery':
            order = await medicineService.dispatchOrder(
                user.userId,
                req.params.id,
                req.body.deliveryPartnerId,
                req.body.trackingId
            );
            break;
        case 'delivered':
            order = await medicineService.completeDelivery(req.params.id, req.body.otp);
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
 * GET /api/v1/medicines/stats or /pharmacy/:pharmacyId/stats
 */
export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const role = user.role === 'patient' ? 'patient' : 'pharmacy';
    const stats = await medicineService.getOrderStats(
        user.userId,
        role as any,
        req.params.pharmacyId
    );
    return sendSuccess(res, stats);
});


