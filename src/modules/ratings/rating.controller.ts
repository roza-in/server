import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { AuthenticatedRequest } from "../../types/request.js";
import { ratingService } from './rating.service.js';

/**
 * Create a new rating
 */
export const createRating = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const data = req.body;
    const result = await ratingService.create(user.userId, data);
    return sendCreated(res, result, 'Rating submitted successfully');
});

/**
 * List all ratings
 */
export const listRatings = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await ratingService.list({
        ...filters,
        page,
        limit
    });

    return sendPaginated(
        res,
        result.data,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get rating by ID
 */
export const getRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const result = await ratingService.getById(ratingId);
    return sendSuccess(res, result);
});

/**
 * Get doctor ratings (public)
 */
export const getDoctorRatings = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await ratingService.list({
        doctorId: doctorId,
        page,
        limit,
        // sortBy: filters.sortBy // sortBy not in interface yet, removed for now or mapped if supported
    });

    return sendPaginated(
        res,
        result.data,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get doctor rating stats (public)
 */
export const getDoctorRatingStats = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const result = await ratingService.getDoctorStats(doctorId);
    return sendSuccess(res, result);
});

/**
 * Respond to rating
 */
export const respondToRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const { response } = req.body;

    const result = await ratingService.respondAsDoctor(ratingId, user.userId, { response });
    return sendSuccess(res, result, 'Response submitted successfully');
});

/**
 * Moderate rating
 */
export const moderateRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const { status, moderationReason } = req.body; // status: 'approved' | 'rejected' | 'hidden'

    const result = await ratingService.moderate(ratingId, status === 'approved', moderationReason); // Assuming logic
    return sendSuccess(res, result, 'Rating moderated successfully');
});
