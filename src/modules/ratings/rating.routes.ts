import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
    createRating,
    listRatings,
    getRating,
    getDoctorRatings,
    getDoctorRatingStats,
    moderateRating,
} from './rating.controller.js';
import {
    createRatingSchema,
    listRatingsSchema,
    getRatingSchema,
    doctorRatingsSchema,
    moderateRatingSchema,
} from './rating.validator.js';

const router = Router();

/**
 * @route GET /api/v1/ratings/doctors/:doctorId
 * @desc Get doctor ratings (public)
 * @access Public
 */
router.get('/doctors/:doctorId', validate(doctorRatingsSchema), getDoctorRatings);

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
router.post('/', roleGuard('patient'), validate(createRatingSchema), createRating);

/**
 * @route GET /api/v1/ratings
 * @desc List all ratings
 * @access Admin, Hospital, Doctor
 */
router.get('/', roleGuard('admin', 'hospital', 'doctor'), validate(listRatingsSchema), listRatings);

/**
 * @route GET /api/v1/ratings/:ratingId
 * @desc Get rating by ID
 * @access Authenticated
 */
router.get('/:ratingId', validate(getRatingSchema), getRating);

/**
 * @route POST /api/v1/ratings/:ratingId/moderate
 * @desc Moderate rating (flag/hide/show)
 * @access Admin
 */
router.post('/:ratingId/moderate', roleGuard('admin'), validate(moderateRatingSchema), moderateRating);

export const ratingRoutes = router;

export default router;

