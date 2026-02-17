import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type { RatingFilters, CreateRatingInput, ModerateRatingInput, RatingStats } from './rating.types.js';

/**
 * Rating Service - Domain module for reviews and ratings
 */
class RatingService {
    private supabase = supabaseAdmin;
    private log = logger.child('RatingService');

    /**
     * Create rating for an appointment
     */
    async create(patientId: string, input: CreateRatingInput) {
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

        // Check if already rated (UNIQUE constraint: appointment_id + patient_id)
        const { data: existing } = await this.supabase
            .from('ratings')
            .select('id')
            .eq('appointment_id', input.appointment_id)
            .eq('patient_id', patientId)
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
                rating: input.rating,
                review: input.review ?? null,
                doctor_rating: input.doctor_rating ?? null,
                hospital_rating: input.hospital_rating ?? null,
                wait_time_rating: input.wait_time_rating ?? null,
                is_visible: true,
                is_flagged: false,
                flag_reason: null,
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
     * Update doctor's average rating in the doctors table
     */
    private async updateDoctorAverageRating(doctorId: string): Promise<void> {
        const { data: ratings } = await this.supabase
            .from('ratings')
            .select('rating')
            .eq('doctor_id', doctorId)
            .eq('is_visible', true);

        if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;

            await this.supabase
                .from('doctors')
                .update({
                    rating: Math.round(avg * 10) / 10,
                    total_ratings: ratings.length,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', doctorId);
        }
    }

    /**
     * List ratings with filters
     */
    async list(filters: RatingFilters) {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('ratings')
            .select(`
                id, rating, review, doctor_rating, hospital_rating, wait_time_rating, created_at,
                patient:users!ratings_patient_id_fkey(name)
            `, { count: 'exact' });

        if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id);
        if (filters.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
        if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);
        if (filters.min_rating) query = query.gte('rating', filters.min_rating);
        if (filters.max_rating) query = query.lte('rating', filters.max_rating);
        if (filters.is_visible !== undefined) query = query.eq('is_visible', filters.is_visible);

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            this.log.error('Failed to list ratings', error);
            throw new BadRequestError('Failed to list ratings');
        }

        const ratings = (data || []).map((r: any) => ({
            ...r,
            patient_name: r.patient?.name ?? null,
        }));

        return {
            data: ratings,
            total: count || 0,
            page,
            limit,
        };
    }

    /**
     * Get rating by ID with relations
     */
    async getById(ratingId: string) {
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
     * Flag/moderate a rating (admin)
     */
    async moderate(ratingId: string, input: ModerateRatingInput) {
        const updateData: Record<string, any> = {};

        if (input.is_visible !== undefined) updateData.is_visible = input.is_visible;
        if (input.is_flagged !== undefined) updateData.is_flagged = input.is_flagged;
        if (input.flag_reason !== undefined) updateData.flag_reason = input.flag_reason;

        if (Object.keys(updateData).length === 0) {
            throw new BadRequestError('No fields to update');
        }

        const { data, error } = await this.supabase
            .from('ratings')
            .update(updateData)
            .eq('id', ratingId)
            .select()
            .single();

        if (error || !data) {
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
            .select('rating')
            .eq('doctor_id', doctorId)
            .eq('is_visible', true);

        const ratings = data || [];
        const total = ratings.length;
        const average = total > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / total : 0;

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(r => {
            const key = Math.round(r.rating);
            distribution[key] = (distribution[key] || 0) + 1;
        });

        return {
            average_rating: Math.round(average * 10) / 10,
            total_ratings: total,
            rating_distribution: distribution,
        };
    }
}

export const ratingService = new RatingService();

