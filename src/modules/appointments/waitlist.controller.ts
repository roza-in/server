import { Request, Response } from 'express';
import { waitlistService } from './waitlist.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Join appointment waitlist
 * POST /api/v1/appointments/waitlist
 */
export const joinWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { doctorId, hospitalId, consultationType, preferredDate, preferredTimeStart, preferredTimeEnd, notes } = req.body;
    const result = await waitlistService.joinWaitlist(
        user.userId,
        doctorId,
        hospitalId,
        consultationType,
        preferredDate,
        preferredTimeStart,
        preferredTimeEnd,
        notes
    );
    return sendCreated(res, result, 'Added to waitlist');
});

/**
 * Get my waitlist entries
 * GET /api/v1/appointments/waitlist
 */
export const getMyWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await waitlistService.getMyWaitlist(user.userId, parseInt(page), parseInt(limit));
    return sendPaginated(
        res,
        result.entries,
        { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }
    );
});

/**
 * Cancel a waitlist entry
 * DELETE /api/v1/appointments/waitlist/:entryId
 */
export const cancelWaitlist = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { entryId } = req.params;
    await waitlistService.cancelWaitlist(entryId, user.userId);
    return sendSuccess(res, null, 'Waitlist entry cancelled');
});

/**
 * Get waiting patients for a doctor (doctor/hospital view)
 * GET /api/v1/appointments/waitlist/doctor/:doctorId
 */
export const getWaitingPatients = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const { date } = req.query as any;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await waitlistService.getWaitingPatients(doctorId, targetDate);
    return sendSuccess(res, result);
});
