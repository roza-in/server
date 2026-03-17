/**
 * Medicine Controller
 * HTTP handlers for medicine e-commerce routes
 * Aligned to migration 007 — centralized ROZX pharmacy model
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
 * GET /api/v1/pharmacy/medicines
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
        calculatePagination(result.total, result.page, result.limit),
    );
});

/**
 * Get medicine by ID
 * GET /api/v1/pharmacy/medicines/:id
 */
export const getMedicineById = asyncHandler(async (req: Request, res: Response) => {
    const medicine = await medicineService.getMedicineById(req.params.id);
    return sendSuccess(res, medicine);
});

// ============================================================================
// Order Management — Patient
// ============================================================================

/**
 * Create medicine order
 * POST /api/v1/pharmacy/medicines/orders
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.createOrder(user.userId, req.body);
    return sendCreated(res, order, 'Order created successfully');
});

/**
 * Get patient's orders
 * GET /api/v1/pharmacy/medicines/orders
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
        calculatePagination(result.total, page, limit),
    );
});

/**
 * Get order by ID
 * GET /api/v1/pharmacy/medicines/orders/:id
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.getOrderById(req.params.id, user.userId);
    return sendSuccess(res, order);
});

/**
 * Get order by order number
 * GET /api/v1/pharmacy/medicines/orders/number/:orderNumber
 */
export const getOrderByNumber = asyncHandler(async (req: Request, res: Response) => {
    const order = await medicineService.getOrderByNumber(req.params.orderNumber);
    return sendSuccess(res, order);
});

/**
 * Cancel order
 * POST /api/v1/pharmacy/medicines/orders/:id/cancel
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.cancelOrder(
        user.userId,
        req.params.id,
        req.body.reason,
    );
    return sendSuccess(res, order, 'Order cancelled successfully');
});

// ============================================================================
// Order Management — Admin / Hospital
// ============================================================================

/**
 * Get hospital orders
 * GET /api/v1/pharmacy/medicines/hospital/:hospitalId/orders
 */
export const getHospitalOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await medicineService.listHospitalOrders(req.params.hospitalId, {
        status: req.query.status as any,
        page,
        limit,
    });
    return sendPaginated(
        res,
        result.orders,
        calculatePagination(result.total, page, limit),
    );
});

/**
 * Confirm order
 * POST /api/v1/pharmacy/medicines/orders/:id/confirm
 */
export const confirmOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.confirmOrder(
        user.userId,
        req.params.id,
        req.body.estimatedReadyTime,
        req.body.notes,
    );
    return sendSuccess(res, order, 'Order confirmed successfully');
});

/**
 * Update order status
 * PATCH /api/v1/pharmacy/medicines/orders/:id/status
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
        case 'dispatched':
            order = await medicineService.dispatchOrder(
                user.userId,
                req.params.id,
                req.body.deliveryPartner,
                req.body.trackingId,
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
 * GET /api/v1/pharmacy/medicines/stats
 */
export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const stats = await medicineService.getOrderStats(
        user.userId,
        user.role,
        req.params.hospitalId || (user as any).hospitalId,
    );
    return sendSuccess(res, stats);
});

// ============================================================================
// Prescription → Order Flow
// ============================================================================

/**
 * Map prescription medicines to catalog
 * GET /api/v1/pharmacy/medicines/prescriptions/:prescriptionId/medicines
 */
export const mapPrescriptionMedicines = asyncHandler(async (req: Request, res: Response) => {
    const mapping = await medicineService.mapPrescriptionToMedicines(req.params.prescriptionId);
    return sendSuccess(res, mapping);
});

/**
 * Create order from prescription
 * POST /api/v1/pharmacy/medicines/orders/from-prescription
 */
export const createOrderFromPrescription = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const order = await medicineService.createOrderFromPrescription(
        user.userId,
        req.body.prescriptionId,
        req.body.deliveryAddress,
        req.body.selectedMedicineIds,
    );
    return sendCreated(res, order, 'Order created from prescription');
});

/**
 * Get patient's unordered prescriptions
 * GET /api/v1/pharmacy/medicines/prescriptions/unordered
 */
export const getUnorderedPrescriptions = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const prescriptions = await medicineService.getUnorderedPrescriptions(user.userId);
    return sendSuccess(res, prescriptions);
});

// ============================================================================
// Delivery Tracking & Returns
// ============================================================================

/**
 * Get delivery tracking events
 * GET /api/v1/pharmacy/medicines/orders/:id/tracking
 */
export const getDeliveryTracking = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const tracking = await medicineService.getDeliveryTracking(req.params.id, user.userId);
    return sendSuccess(res, tracking);
});

/**
 * Create a return request
 * POST /api/v1/pharmacy/medicines/orders/:id/return
 */
export const createReturn = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const returnRequest = await medicineService.createReturn(
        user.userId,
        req.params.id,
        req.body,
    );
    return sendCreated(res, returnRequest, 'Return request created');
});

/**
 * Get returns for an order
 * GET /api/v1/pharmacy/medicines/orders/:id/returns
 */
export const getReturns = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const returns = await medicineService.getReturns(req.params.id, user.userId);
    return sendSuccess(res, returns);
});

// ============================================================================
// Medicine CRUD (Pharmacy / Admin)
// ============================================================================

export const createMedicine = asyncHandler(async (req: Request, res: Response) => {
    const medicine = await medicineService.createMedicine(req.body);
    return sendCreated(res, medicine, 'Medicine created successfully');
});

export const updateMedicine = asyncHandler(async (req: Request, res: Response) => {
    const medicine = await medicineService.updateMedicine(req.params.id, req.body);
    return sendSuccess(res, medicine, 'Medicine updated successfully');
});

export const deleteMedicine = asyncHandler(async (req: Request, res: Response) => {
    await medicineService.deleteMedicine(req.params.id);
    return sendSuccess(res, null, 'Medicine deactivated successfully');
});

export const listAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await medicineService.listAllOrders({
        status: req.query.status as any,
        page,
        limit,
    });
    return sendPaginated(
        res,
        result.orders,
        calculatePagination(result.total, page, limit),
    );
});