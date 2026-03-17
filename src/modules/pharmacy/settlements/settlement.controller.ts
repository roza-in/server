/**
 * Pharmacy Settlement Controller
 * HTTP handlers for pharmacy settlement management
 */

import { Request, Response } from 'express';
import { pharmacySettlementService } from './settlement.service.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../../common/responses/index.js';
import { asyncHandler } from '../../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../../types/request.js';

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * Calculate pharmacy settlement
 * POST /api/v1/pharmacy/settlements
 */
export const calculateSettlement = asyncHandler(async (req: Request, res: Response) => {
    const result = await pharmacySettlementService.calculate(req.body);
    return sendCreated(res, result, 'Settlement calculated successfully');
});

/**
 * List all pharmacy settlements
 * GET /api/v1/pharmacy/settlements
 */
export const listSettlements = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await pharmacySettlementService.list({
        hospitalId: req.query.hospitalId as string,
        status: req.query.status as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page,
        limit,
    });

    return sendPaginated(
        res,
        result.settlements,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get settlement by ID
 * GET /api/v1/pharmacy/settlements/:id
 */
export const getSettlement = asyncHandler(async (req: Request, res: Response) => {
    const result = await pharmacySettlementService.getById(req.params.id);
    return sendSuccess(res, result);
});

/**
 * Process settlement (start payout)
 * POST /api/v1/pharmacy/settlements/:id/process
 */
export const processSettlement = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await pharmacySettlementService.processSettlement(
        req.params.id,
        user.userId,
        req.body
    );
    return sendSuccess(res, result, 'Settlement processing initiated');
});

/**
 * Complete settlement
 * POST /api/v1/pharmacy/settlements/:id/complete
 */
export const completeSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { utrNumber } = req.body;
    const result = await pharmacySettlementService.completeSettlement(req.params.id, utrNumber);
    return sendSuccess(res, result, 'Settlement marked as completed');
});

// ============================================================================
// Hospital Routes
// ============================================================================

/**
 * Get my hospital's pharmacy settlements
 * GET /api/v1/pharmacy/settlements/my
 */
export const getMySettlements = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await pharmacySettlementService.getHospitalSettlements(user.userId, page, limit);

    return sendPaginated(
        res,
        result.settlements,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get pharmacy settlement statistics
 * GET /api/v1/pharmacy/settlements/stats
 */
export const getSettlementStats = asyncHandler(async (req: Request, res: Response) => {
    const hospitalId = req.query.hospitalId as string | undefined;
    const result = await pharmacySettlementService.getStats(hospitalId);
    return sendSuccess(res, result);
});
