import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import { refundService } from './refund.service.js';
import type { RefundFilters } from './refund.types.js';

/**
 * Get refund statistics
 * GET /api/v1/refunds/stats
 */
export const getRefundStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await refundService.getStats();
    return sendSuccess(res, result);
});

/**
 * List all refunds
 * GET /api/v1/refunds
 */
export const listRefunds = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;

    const filters: RefundFilters = {
        page,
        limit,
        payment_id: query.payment_id,
        status: query.status as any,
        reason: query.reason as any,
        initiated_by: query.initiated_by,
    };

    const result = await refundService.list(filters);
    const pagination = calculatePagination(result.total, page, limit);
    return sendPaginated(res, result.data, pagination);
});

/**
 * Create a refund request
 * POST /api/v1/refunds
 */
export const createRefund = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await refundService.create(req.body, user.userId);
    return sendCreated(res, result, 'Refund request created successfully');
});

/**
 * Get refund by ID
 * GET /api/v1/refunds/:refundId
 */
export const getRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const result = await refundService.getById(refundId);
    return sendSuccess(res, result);
});

/**
 * Process refund (approve/reject)
 * POST /api/v1/refunds/:refundId/process
 */
export const processRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const { action, notes } = req.body;

    const result = await refundService.process(refundId, { action, notes });
    return sendSuccess(res, result, `Refund ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
});
