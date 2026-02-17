/**
 * Medicine Return Controller
 * HTTP handlers for medicine return management
 */

import { Request, Response } from 'express';
import { returnService } from './return.service.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../../common/responses/index.js';
import { asyncHandler } from '../../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.js';

// ============================================================================
// Patient Routes
// ============================================================================

/**
 * Create medicine return
 * POST /api/v1/pharmacy/returns/:orderId
 */
export const createReturn = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await returnService.createReturn(user.userId, req.params.orderId, req.body);
    return sendCreated(res, result, 'Return request submitted successfully');
});

/**
 * Get patient's returns
 * GET /api/v1/pharmacy/returns
 */
export const getMyReturns = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await returnService.listPatientReturns(user.userId, {
        status: req.query.status as string,
        page,
        limit,
    });

    return sendPaginated(
        res,
        result.returns,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get return by ID
 * GET /api/v1/pharmacy/returns/:id
 */
export const getReturnById = asyncHandler(async (req: Request, res: Response) => {
    const result = await returnService.getReturnById(req.params.id);
    return sendSuccess(res, result);
});

/**
 * Get return by return number
 * GET /api/v1/pharmacy/returns/number/:returnNumber
 */
export const getReturnByNumber = asyncHandler(async (req: Request, res: Response) => {
    const result = await returnService.getReturnByNumber(req.params.returnNumber);
    return sendSuccess(res, result);
});

// ============================================================================
// Admin / Pharmacy Routes
// ============================================================================

/**
 * List all returns
 * GET /api/v1/pharmacy/returns/all
 */
export const listReturns = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await returnService.listReturns({
        orderId: req.query.orderId as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page,
        limit,
    });

    return sendPaginated(
        res,
        result.returns,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Review return (approve/reject)
 * POST /api/v1/pharmacy/returns/:id/review
 */
export const reviewReturn = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await returnService.reviewReturn(user.userId, req.params.id, req.body);
    return sendSuccess(res, result, `Return ${req.body.status} successfully`);
});

/**
 * Complete pickup
 * POST /api/v1/pharmacy/returns/:id/pickup-complete
 */
export const completePickup = asyncHandler(async (req: Request, res: Response) => {
    const result = await returnService.completePickup(req.params.id);
    return sendSuccess(res, result, 'Pickup marked as completed');
});

/**
 * Get return statistics
 * GET /api/v1/pharmacy/returns/stats
 */
export const getReturnStats = asyncHandler(async (req: Request, res: Response) => {
    const hospitalId = req.query.hospitalId as string | undefined;
    const result = await returnService.getStats(hospitalId);
    return sendSuccess(res, result);
});
