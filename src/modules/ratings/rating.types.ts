// ============================================================================
// Rating Module Types
// Re-exports canonical Rating from database.types.ts
// ============================================================================

import type { Rating as DBRating } from '../../types/database.types.js';

/** Canonical Rating type from DB */
export type Rating = DBRating;

/** Rating with joined relations */
export interface RatingWithRelations extends Rating {
    patient?: { name: string; avatar_url: string | null } | null;
    appointment?: { id: string; scheduled_date: string } | null;
}

/** Rating list item (select projection) */
export interface RatingListItem {
    id: string;
    rating: number;
    review: string | null;
    doctor_rating: number | null;
    hospital_rating: number | null;
    wait_time_rating: number | null;
    created_at: string;
    patient_name: string | null;
}

/** Filters for listing ratings */
export interface RatingFilters {
    doctor_id?: string;
    hospital_id?: string;
    patient_id?: string;
    min_rating?: number;
    max_rating?: number;
    is_visible?: boolean;
    page?: number;
    limit?: number;
}

/** Input for creating a rating */
export interface CreateRatingInput {
    appointment_id: string;
    rating: number;
    review?: string | null;
    doctor_rating?: number | null;
    hospital_rating?: number | null;
    wait_time_rating?: number | null;
}

/** Input for flagging/moderating a rating */
export interface ModerateRatingInput {
    is_visible?: boolean;
    is_flagged?: boolean;
    flag_reason?: string | null;
}

/** Doctor rating stats (computed) */
export interface RatingStats {
    average_rating: number;
    total_ratings: number;
    rating_distribution: Record<number, number>;
}

