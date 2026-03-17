import { Request, Response } from 'express';
import { creditService } from './credit.service.js';
import { sendSuccess, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Get current user's credit balance
 * GET /api/v1/patients/credits/balance
 */
export const getBalance = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await creditService.getBalance(user.userId);
    return sendSuccess(res, result);
});

/**
 * Get credit transaction history
 * GET /api/v1/patients/credits/transactions
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await creditService.getTransactions(
        user.userId,
        parseInt(page),
        parseInt(limit)
    );
    return sendPaginated(
        res,
        result.transactions,
        { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }
    );
});

/**
 * Add credit to a patient (admin only)
 * POST /api/v1/patients/:userId/credits
 */
export const addCredit = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { amount, description, referenceType, referenceId, expiresAt } = req.body;
    const result = await creditService.addCredit(userId, amount, description, referenceType, referenceId, expiresAt);
    return sendSuccess(res, result, 'Credit added successfully');
});
