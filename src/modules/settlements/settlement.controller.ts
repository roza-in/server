import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { AuthenticatedRequest } from "../../types/request.js";
import { settlementService } from './settlement.service.js';

/**
 * Get settlement statistics
 */
export const getSettlementStats = asyncHandler(async (req: Request, res: Response) => {
    // Service method takes no args
    const result = await settlementService.getStats();
    return sendSuccess(res, result);
});

/**
 * Get my hospital settlements
 */
export const getMySettlements = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;

    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await settlementService.getHospitalSettlements(user.userId, page, limit);

    return sendPaginated(
        res,
        result.settlements,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * List all settlements
 */
export const listSettlements = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await settlementService.list({
        ...filters,
        page,
        limit
    });

    return sendPaginated(
        res,
        result.settlements,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Calculate new settlement
 */
export const calculateSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, startDate, endDate } = req.body;
    const result = await settlementService.calculate({ hospital_id: hospitalId, period_start: startDate, period_end: endDate });
    return sendSuccess(res, result, 'Settlement calculated successfully');
});

/**
 * Get settlement by ID
 */
export const getSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const result = await settlementService.getById(settlementId);
    return sendSuccess(res, result);
});

/**
 * Initiate payout
 */
export const initiatePayout = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    // Service method takes only settlementId
    const result = await settlementService.initiatePayout(settlementId);
    return sendSuccess(res, result, 'Payout initiated successfully');
});

/**
 * Mark settlement as completed
 */
export const completeSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const { transactionReference } = req.body;
    // Service method takes settlementId and bankReference
    const result = await settlementService.complete(settlementId, transactionReference);
    return sendSuccess(res, result, 'Settlement marked as completed');
});
