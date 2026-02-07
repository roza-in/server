import { Request, Response } from 'express';
import { refundService } from './refund.service.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * List refunds
 * GET /api/v1/refunds
 */
export const listRefunds = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await refundService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.refunds, pagination);
});

/**
 * Get refund by ID
 * GET /api/v1/refunds/:refundId
 */
export const getRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const refund = await refundService.getById(refundId);
    return sendSuccess(res, refund);
});

/**
 * Create refund request
 * POST /api/v1/refunds
 */
export const createRefund = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const refund = await refundService.create(req.body, user.userId);
    return sendSuccess(res, refund, 'Refund request created', 201);
});

/**
 * Process refund (approve/reject)
 * POST /api/v1/refunds/:refundId/process
 */
export const processRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const refund = await refundService.process(refundId, req.body);
    return sendSuccess(res, refund, 'Refund processed successfully');
});

/**
 * Get refund stats
 * GET /api/v1/refunds/stats
 */
export const getRefundStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await refundService.getStats();
    return sendSuccess(res, stats);
});

export { refundService } from './refund.service.js';
export * from './refund.types.js';

