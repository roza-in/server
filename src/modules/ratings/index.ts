import { Request, Response } from 'express';
import { ratingService } from './rating.service.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Create rating
 */
export const createRating = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const rating = await ratingService.create(user.userId, req.body);
    return sendSuccess(res, rating, 'Rating submitted successfully', 201);
});

/**
 * List ratings
 */
export const listRatings = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await ratingService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.ratings, pagination);
});

/**
 * Get rating by ID
 */
export const getRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const rating = await ratingService.getById(ratingId);
    return sendSuccess(res, rating);
});

/**
 * Get doctor ratings
 */
export const getDoctorRatings = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const filters = { ...req.query, doctorId } as any;
    const result = await ratingService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.ratings, pagination);
});

/**
 * Get doctor rating stats
 */
export const getDoctorRatingStats = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const stats = await ratingService.getDoctorStats(doctorId);
    return sendSuccess(res, stats);
});

/**
 * Doctor responds to rating
 */
export const respondToRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const doctorId = user.doctorId || user.userId;
    const rating = await ratingService.respondAsDoctor(ratingId, doctorId, req.body);
    return sendSuccess(res, rating, 'Response added successfully');
});

/**
 * Moderate rating (hide/show)
 */
export const moderateRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const { visible, reason } = req.body;
    const user = (req as AuthenticatedRequest).user;
    const rating = await ratingService.moderate(ratingId, visible, reason, user.userId);
    return sendSuccess(res, rating, 'Rating moderated successfully');
});

export { ratingService } from './rating.service.js';
export * from './rating.types.js';

