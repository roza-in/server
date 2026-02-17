import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import { ratingService } from './rating.service.js';
import type { RatingFilters } from './rating.types.js';

/**
 * Create a new rating
 * POST /api/v1/ratings
 */
export const createRating = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const result = await ratingService.create(user.userId, req.body);
    return sendCreated(res, result, 'Rating submitted successfully');
});

/**
 * List all ratings
 * GET /api/v1/ratings
 */
export const listRatings = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const query = req.query as Record<string, string>;

    const filters: RatingFilters = {
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
        min_rating: query.min_rating ? parseInt(query.min_rating) : undefined,
        max_rating: query.max_rating ? parseInt(query.max_rating) : undefined,
        is_visible: query.is_visible !== undefined ? query.is_visible === 'true' : undefined,
    };

    // Role-based filter enforcement
    if (user.role === 'hospital') {
        filters.hospital_id = user.hospitalId;
    } else if (user.role === 'doctor') {
        filters.doctor_id = user.doctorId || user.userId;
    } else if (query.doctor_id) {
        filters.doctor_id = query.doctor_id;
    }

    if (query.hospital_id && user.role === 'admin') {
        filters.hospital_id = query.hospital_id;
    }

    const result = await ratingService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.data, pagination);
});

/**
 * Get rating by ID
 * GET /api/v1/ratings/:ratingId
 */
export const getRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const result = await ratingService.getById(ratingId);
    return sendSuccess(res, result);
});

/**
 * Get doctor ratings (public)
 * GET /api/v1/ratings/doctors/:doctorId
 */
export const getDoctorRatings = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const query = req.query as Record<string, string>;
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 20;

    const result = await ratingService.list({
        doctor_id: doctorId,
        is_visible: true,
        page,
        limit,
    });

    const pagination = calculatePagination(result.total, page, limit);
    return sendPaginated(res, result.data, pagination);
});

/**
 * Get doctor rating stats (public)
 * GET /api/v1/ratings/doctors/:doctorId/stats
 */
export const getDoctorRatingStats = asyncHandler(async (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const result = await ratingService.getDoctorStats(doctorId);
    return sendSuccess(res, result);
});

/**
 * Moderate rating (flag/hide/show)
 * POST /api/v1/ratings/:ratingId/moderate
 */
export const moderateRating = asyncHandler(async (req: Request, res: Response) => {
    const { ratingId } = req.params;
    const result = await ratingService.moderate(ratingId, req.body);
    return sendSuccess(res, result, 'Rating moderated successfully');
});
