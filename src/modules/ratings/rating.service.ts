import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type { RatingFilters, CreateRatingInput, RespondToRatingInput, RatingStats } from './rating.types.js';

/**
 * Rating Service - Domain module for reviews and ratings
 */
class RatingService {
    private supabase = supabaseAdmin;
    private log = logger.child('RatingService');

    /**
     * Create rating for an appointment
     */
    async create(patientId: string, input: CreateRatingInput): Promise<any> {
        // Verify appointment and get doctor/hospital
        const { data: appointment, error: aptErr } = await this.supabase
            .from('appointments')
            .select('id, doctor_id, hospital_id, patient_id, status')
            .eq('id', input.appointment_id)
            .single();

        if (aptErr || !appointment) {
            throw new NotFoundError('Appointment not found');
        }

        if (appointment.patient_id !== patientId) {
            throw new BadRequestError('You can only rate your own appointments');
        }

        if (appointment.status !== 'completed') {
            throw new BadRequestError('You can only rate completed appointments');
        }

        // Check if already rated
        const { data: existing } = await this.supabase
            .from('ratings')
            .select('id')
            .eq('appointment_id', input.appointment_id)
            .single();

        if (existing) {
            throw new BadRequestError('You have already rated this appointment');
        }

        const { data, error } = await this.supabase
            .from('ratings')
            .insert({
                appointment_id: input.appointment_id,
                patient_id: patientId,
                doctor_id: appointment.doctor_id,
                hospital_id: appointment.hospital_id,
                overall_rating: input.overall_rating,
                doctor_rating: input.doctor_rating,
                hospital_rating: input.hospital_rating,
                wait_time_rating: input.wait_time_rating,
                staff_behavior_rating: input.staff_behavior_rating,
                consultation_quality_rating: input.consultation_quality_rating,
                review: input.review,
                is_anonymous: input.is_anonymous || false,
                is_verified: true,
            })
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create rating', error);
            throw new BadRequestError('Failed to create rating');
        }

        // Update doctor average rating
        await this.updateDoctorAverageRating(appointment.doctor_id);

        return data;
    }

    /**
     * Update doctor's average rating
     */
    private async updateDoctorAverageRating(doctorId: string): Promise<void> {
        const { data: ratings } = await this.supabase
            .from('ratings')
            .select('doctor_rating')
            .eq('doctor_id', doctorId)
            .eq('is_visible', true);

        if (ratings && ratings.length > 0) {
            const validRatings = ratings.filter(r => r.doctor_rating != null);
            const avg = validRatings.reduce((s, r) => s + r.doctor_rating!, 0) / validRatings.length;

            await this.supabase
                .from('doctors')
                .update({
                    rating: Math.round(avg * 10) / 10,
                    total_ratings: validRatings.length,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', doctorId);
        }
    }

    /**
     * List ratings with filters
     */
    async list(filters: RatingFilters): Promise<any> {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('ratings')
            .select(`
        id, overall_rating, review, is_anonymous, created_at, doctor_response,
        patient:users!ratings_patient_id_fkey(name)
      `, { count: 'exact' });

        if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId);
        if (filters.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
        if (filters.patientId) query = query.eq('patient_id', filters.patientId);
        if (filters.minRating) query = query.gte('overall_rating', filters.minRating);
        if (filters.maxRating) query = query.lte('overall_rating', filters.maxRating);
        if (filters.isVisible !== undefined) query = query.eq('is_visible', filters.isVisible);

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            this.log.error('Failed to list ratings', error);
            throw new BadRequestError('Failed to list ratings');
        }

        // Mask patient names for anonymous reviews
        const ratings = (data || []).map((r: any) => ({
            ...r,
            patient_name: r.is_anonymous ? null : r.patient?.name,
        }));

        return {
            ratings,
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        };
    }

    /**
     * Get rating by ID
     */
    async getById(ratingId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('ratings')
            .select(`
        *,
        patient:users!ratings_patient_id_fkey(name, avatar_url),
        appointment:appointments(id, scheduled_date)
      `)
            .eq('id', ratingId)
            .single();

        if (error || !data) {
            throw new NotFoundError('Rating not found');
        }

        return data;
    }

    /**
     * Doctor responds to rating
     */
    async respondAsDoctor(ratingId: string, doctorId: string, input: RespondToRatingInput): Promise<any> {
        const { data: rating } = await this.supabase
            .from('ratings')
            .select('doctor_id')
            .eq('id', ratingId)
            .single();

        if (!rating || rating.doctor_id !== doctorId) {
            throw new BadRequestError('You can only respond to your own ratings');
        }

        const { data, error } = await this.supabase
            .from('ratings')
            .update({
                doctor_response: input.response,
                doctor_responded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', ratingId)
            .select()
            .single();

        if (error) {
            throw new BadRequestError('Failed to respond to rating');
        }

        return data;
    }

    /**
     * Hide/Show rating (moderation)
     */
    async moderate(ratingId: string, visible: boolean, reason?: string, moderatorId?: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('ratings')
            .update({
                is_visible: visible,
                hidden_reason: visible ? null : reason,
                hidden_by: visible ? null : moderatorId,
                hidden_at: visible ? null : new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', ratingId)
            .select()
            .single();

        if (error) {
            throw new BadRequestError('Failed to moderate rating');
        }

        return data;
    }

    /**
     * Get doctor rating stats
     */
    async getDoctorStats(doctorId: string): Promise<RatingStats> {
        const { data } = await this.supabase
            .from('ratings')
            .select('overall_rating')
            .eq('doctor_id', doctorId)
            .eq('is_visible', true);

        const ratings = data || [];
        const total = ratings.length;
        const average = total > 0 ? ratings.reduce((s, r) => s + r.overall_rating, 0) / total : 0;

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(r => {
            distribution[r.overall_rating] = (distribution[r.overall_rating] || 0) + 1;
        });

        return {
            average_rating: Math.round(average * 10) / 10,
            total_ratings: total,
            rating_distribution: distribution,
        };
    }
}

export const ratingService = new RatingService();

