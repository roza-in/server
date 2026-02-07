import { Request, Response } from 'express';
import { settlementService } from './settlement.service.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * List settlements
 */
export const listSettlements = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await settlementService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.settlements, pagination);
});

/**
 * Get settlement by ID
 */
export const getSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const settlement = await settlementService.getById(settlementId);
    return sendSuccess(res, settlement);
});

/**
 * Calculate settlement
 */
export const calculateSettlement = asyncHandler(async (req: Request, res: Response) => {
    const settlement = await settlementService.calculate(req.body);
    return sendSuccess(res, settlement, 'Settlement calculated', 201);
});

/**
 * Get my hospital settlements
 */
export const getMySettlements = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { page, limit } = req.query as any;
    const result = await settlementService.getHospitalSettlements(user.hospitalId!, Number(page) || 1, Number(limit) || 20);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.settlements, pagination);
});

/**
 * Initiate payout
 */
export const initiatePayout = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const settlement = await settlementService.initiatePayout(settlementId);
    return sendSuccess(res, settlement, 'Payout initiated');
});

/**
 * Complete settlement
 */
export const completeSettlement = asyncHandler(async (req: Request, res: Response) => {
    const { settlementId } = req.params;
    const { bankReference } = req.body;
    const settlement = await settlementService.complete(settlementId, bankReference);
    return sendSuccess(res, settlement, 'Settlement completed');
});

/**
 * Get settlement stats
 */
export const getSettlementStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await settlementService.getStats();
    return sendSuccess(res, stats);
});

export { settlementService } from './settlement.service.js';
export * from './settlement.types.js';

