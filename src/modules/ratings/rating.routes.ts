import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import { roleGuard } from '@/middlewares/role.middleware.js';
import {
    createRating,
    listRatings,
    getRating,
    getDoctorRatings,
    getDoctorRatingStats,
    respondToRating,
    moderateRating,
} from './rating.controller.js';

const router = Router();

/**
 * @route GET /api/v1/ratings/doctors/:doctorId
 * @desc Get doctor ratings (public)
 * @access Public
 */
router.get('/doctors/:doctorId', getDoctorRatings);

/**
 * @route GET /api/v1/ratings/doctors/:doctorId/stats
 * @desc Get doctor rating stats (public)
 * @access Public
 */
router.get('/doctors/:doctorId/stats', getDoctorRatingStats);

// Protected routes
router.use(authMiddleware);

/**
 * @route POST /api/v1/ratings
 * @desc Create a new rating
 * @access Patient
 */
router.post('/', roleGuard('patient'), createRating);

/**
 * @route GET /api/v1/ratings
 * @desc List all ratings
 * @access Admin, Hospital
 */
router.get('/', roleGuard('admin', 'hospital'), listRatings);

/**
 * @route GET /api/v1/ratings/:ratingId
 * @desc Get rating by ID
 * @access Authenticated
 */
router.get('/:ratingId', getRating);

/**
 * @route POST /api/v1/ratings/:ratingId/respond
 * @desc Doctor responds to rating
 * @access Doctor
 */
router.post('/:ratingId/respond', roleGuard('doctor'), respondToRating);

/**
 * @route POST /api/v1/ratings/:ratingId/moderate
 * @desc Moderate rating (hide/show)
 * @access Admin
 */
router.post('/:ratingId/moderate', roleGuard('admin'), moderateRating);

export const ratingRoutes = router;

export default router;

