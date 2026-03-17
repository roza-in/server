import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../common/validators.js';

// ============================================================================
// Rating Validators
// ============================================================================

const ratingValue = z.coerce.number().int().min(1).max(5);

/**
 * POST /api/v1/ratings
 */
export const createRatingSchema = z.object({
    appointment_id: uuidSchema,
    rating: ratingValue,
    review: z.string().max(2000).optional(),
    doctor_rating: ratingValue.optional(),
    hospital_rating: ratingValue.optional(),
    wait_time_rating: ratingValue.optional(),
});

/**
 * GET /api/v1/ratings
 */
export const listRatingsSchema = paginationSchema.extend({
    doctor_id: uuidSchema.optional(),
    hospital_id: uuidSchema.optional(),
    patient_id: uuidSchema.optional(),
    min_rating: z.coerce.number().int().min(1).max(5).optional(),
    max_rating: z.coerce.number().int().min(1).max(5).optional(),
    is_visible: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

/**
 * GET /api/v1/ratings/:ratingId
 */
export const getRatingSchema = z.object({
    ratingId: uuidSchema,
});

/**
 * GET /api/v1/ratings/doctors/:doctorId
 */
export const doctorRatingsSchema = paginationSchema.extend({
    doctorId: uuidSchema,
});

/**
 * POST /api/v1/ratings/:ratingId/moderate
 */
export const moderateRatingSchema = z.object({
    is_visible: z.boolean().optional(),
    is_flagged: z.boolean().optional(),
    flag_reason: z.string().max(500).optional(),
});
