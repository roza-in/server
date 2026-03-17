import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import { settlementService } from './settlement.service.js';

/**
 * List all settlements (admin)
 */
export const listSettlements = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, status, entityType, entityId, startDate, endDate } = req.query as any;

  const result = await settlementService.list({
    status,
    entityType,
    entityId,
    startDate,
    endDate,
    page: Number(page),
    limit: Number(limit),
  });

  return sendPaginated(
    res,
    result.data,
    calculatePagination(result.total, Number(page), Number(limit)),
  );
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
 * Get my hospital settlements
 */
export const getMySettlements = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { page = 1, limit = 20 } = req.query as any;

  const result = await settlementService.getEntitySettlements(
    'hospital',
    user.hospitalId!,
    Number(page),
    Number(limit),
  );

  return sendPaginated(
    res,
    result.data,
    calculatePagination(result.total, Number(page), Number(limit)),
  );
});

/**
 * Calculate (create) a new settlement
 */
export const calculateSettlement = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, periodStart, periodEnd } = req.body;

  const settlement = await settlementService.calculate({
    entityType,
    entityId,
    periodStart,
    periodEnd,
  });

  return sendCreated(res, settlement, 'Settlement calculated successfully');
});

/**
 * Approve a pending settlement
 */
export const approveSettlement = asyncHandler(async (req: Request, res: Response) => {
  const { settlementId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  const settlement = await settlementService.approve(settlementId, user.userId);
  return sendSuccess(res, settlement, 'Settlement approved');
});

/**
 * Initiate payout for an approved settlement
 */
export const initiatePayout = asyncHandler(async (req: Request, res: Response) => {
  const { settlementId } = req.params;
  const settlement = await settlementService.initiatePayout(settlementId);
  return sendSuccess(res, settlement, 'Payout initiated');
});

/**
 * Mark settlement as completed with UTR
 */
export const completeSettlement = asyncHandler(async (req: Request, res: Response) => {
  const { settlementId } = req.params;
  const { utrNumber } = req.body;

  const settlement = await settlementService.complete(settlementId, { utrNumber });
  return sendSuccess(res, settlement, 'Settlement completed');
});

/**
 * Get settlement statistics (admin dashboard)
 */
export const getSettlementStats = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = (req.query || {}) as any;
  const stats = await settlementService.getStats({ entityType, entityId });
  return sendSuccess(res, stats);
});

