// ============================================================================
// Rating Module Types
// ============================================================================

export interface Rating {
    id: string;
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    hospital_id: string | null;
    overall_rating: number;
    doctor_rating: number | null;
    hospital_rating: number | null;
    wait_time_rating: number | null;
    staff_behavior_rating: number | null;
    consultation_quality_rating: number | null;
    review: string | null;
    is_anonymous: boolean;
    doctor_response: string | null;
    doctor_responded_at: string | null;
    hospital_response: string | null;
    hospital_responded_at: string | null;
    is_visible: boolean;
    is_verified: boolean;
    helpful_count: number;
    created_at: string;
    updated_at: string;
}

export interface RatingListItem {
    id: string;
    overall_rating: number;
    review: string | null;
    is_anonymous: boolean;
    patient_name: string | null;
    created_at: string;
    doctor_response: string | null;
}

export interface RatingFilters {
    doctorId?: string;
    hospitalId?: string;
    patientId?: string;
    minRating?: number;
    maxRating?: number;
    isVisible?: boolean;
    page?: number;
    limit?: number;
}

export interface CreateRatingInput {
    appointment_id: string;
    overall_rating: number;
    doctor_rating?: number;
    hospital_rating?: number;
    wait_time_rating?: number;
    staff_behavior_rating?: number;
    consultation_quality_rating?: number;
    review?: string;
    is_anonymous?: boolean;
}

export interface RespondToRatingInput {
    response: string;
}

export interface RatingStats {
    average_rating: number;
    total_ratings: number;
    rating_distribution: Record<number, number>;
}

