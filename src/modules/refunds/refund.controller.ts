import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { AuthenticatedRequest } from "../../types/request.js";
import { refundService } from './refund.service.js';

/**
 * Get refund statistics
 */
export const getRefundStats = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await refundService.getStats();
    return sendSuccess(res, result);
});

/**
 * List all refunds
 */
export const listRefunds = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await refundService.list({
        ...filters,
        page,
        limit
    });

    return sendPaginated(
        res,
        result.refunds,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Create a refund request
 */
export const createRefund = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const data = req.body;

    const result = await refundService.create(data, user.userId);
    return sendCreated(res, result, 'Refund request created successfully');
});

/**
 * Get refund by ID
 */
export const getRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const result = await refundService.getById(refundId);
    return sendSuccess(res, result);
});

/**
 * Process refund (approve/reject)
 */
export const processRefund = asyncHandler(async (req: Request, res: Response) => {
    const { refundId } = req.params;
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user; // Admin user processing the refund
    const { status, notes, rejectionReason } = req.body; // status: 'approved' | 'rejected'

    const result = await refundService.process(refundId, {
        action: status === 'approved' ? 'approve' : 'reject',
        notes: status === 'rejected' && rejectionReason ? `${notes || ''} - ${rejectionReason}` : notes
    });

    return sendSuccess(res, result, `Refund ${status} successfully`);
});
