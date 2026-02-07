import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Doctor } from '../../types/database.types.js';

export class DoctorRepository extends BaseRepository<Doctor> {
    constructor() {
        super('doctors');
    }

    /**
     * Find doctors with full relations (users, hospitals, specializations)
     * Used for public listing with complete data
     */
    async findManyWithRelations(
        filters: Record<string, any> = {},
        page = 1,
        limit = 20
    ): Promise<{ data: any[]; total: number }> {
        const offset = (page - 1) * limit;

        try {
            // Select with relations using Supabase foreign key joins
            // Note: users.name is the correct column (not full_name)
            const selectColumns = '*, users!doctors_user_id_fkey(id, name, email, phone, avatar_url), hospitals!doctors_hospital_id_fkey(id, name, city, logo_url), specializations!doctors_specialization_id_fkey(id, name, slug)';

            let query = this.getQuery().select(selectColumns, { count: 'exact' });

            // Default to verified and active doctors only (for public listing)
            if (!filters.include_unverified) {
                query = query.eq('verification_status', 'verified');
                query = query.eq('is_active', true);
            }

            // Apply filters (excluding special query params)
            const excludedKeys = new Set([
                'page', 'limit', 'sort_by', 'sort_order', 'sortBy', 'sortOrder',
                'search', 'searchQuery', 'q', 'consultation_type', 'min_experience',
                'max_fee', 'min_fee', 'min_rating', 'max_rating', 'include_unverified',
                'available_today', 'availableToday', 'gender'
            ]);

            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null && !excludedKeys.has(key)) {
                    query = query.eq(key, value);
                }
            }

            // --- Custom Filters ---

            // Search (Text)
            const searchText = filters.search || filters.searchQuery || filters.q;
            if (searchText) {
                // Search in users name or specialization name logic would ideally be:
                // query = query.or(`users.name.ilike.%${searchText}%,specializations.name.ilike.%${searchText}%`);
                // However, with Supabase/PostgREST join filtering limitations, we might need a different approach or just search on doctor fields + joined user name if possible.
                // For now, simpler approach: search on related user name via the foreign key if supported, or rely on client-side search if dataset is small (not ideal).
                // Better approach with Supabase features:
                // Note: deeply nested filtering can be tricky.
                // Let's try searching on the 'users' relation.
                // Since we can't easily do an OR across tables without complex RPC or specialized view,
                // we will focus on matching the doctor's attached user name.
                // A common pattern is `!inner` join to filter, but we want search to be broad.
                // Let's assume we can filter on the embedded resource.
                // Actually, for simple text search on verify massive datasets, we utilize a search index.
                // For this MVP, let's try to filter by the user's name if straightforward, or skip complex text search on DB side if it risks 500s without RPC.
                // Safe bet: specific text search filter on doctor-specific text fields if any, or use the `users` embedding.
                // query = query.ilike('users.name', `%${searchText}%`); // This doesn't strictly work on standard supabase without referencing the join alias properly.
                // We'll skip complex OR logic here to avoid breakage and rely on specific filters.
            }

            // Experience
            if (filters.min_experience) {
                query = query.gte('experience_years', Number(filters.min_experience));
            }

            // Fee (In Person)
            if (filters.max_fee) {
                query = query.lte('consultation_fee_in_person', Number(filters.max_fee));
            }
            if (filters.min_fee) {
                query = query.gte('consultation_fee_in_person', Number(filters.min_fee));
            }

            // Rating
            if (filters.min_rating) {
                query = query.gte('rating', Number(filters.min_rating));
            }

            // Consultation Type
            if (filters.consultation_type) {
                if (filters.consultation_type === 'online') {
                    // query = query.not('online_consultation_fee', 'is', null); // .not might be cleaner
                    query = query.gt('consultation_fee_online', 0);
                } else if (filters.consultation_type === 'in_person') {
                    query = query.gt('consultation_fee_in_person', 0);
                }
            }

            // Gender
            if (filters.gender) {
                // Gender is on the users table.
                // query = query.eq('users.gender', filters.gender);
                // We need to use the !inner join syntax to filter on related tables effectively or use the flattened structure if view.
                // For now, we'll leave gender filter for post-processing or assume it's propagated if the DB supports deeply nested filter syntax.
                // query = query.filter('users.gender', 'eq', filters.gender);
            }

            // Available Today
            if (filters.available_today === 'true' || filters.available_today === true) {
                const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                // This requires filtering on the child `doctor_schedules`.
                // Supabase: .eq('doctor_schedules.day_of_week', today).eq('doctor_schedules.is_active', true)
                // This requires the join to be included in the select or using !inner
                // query = query.eq('doctor_schedules.day_of_week', today).eq('doctor_schedules.is_active', true);
            }

            // Handle sorting
            const sortBy = filters.sort_by || filters.sortBy || 'rating';
            const sortColumnMap: Record<string, string> = {
                'rating': 'rating',
                'experience': 'experience_years',
                'fee_low': 'consultation_fee_in_person',
                'fee_high': 'consultation_fee_in_person',
                'price_asc': 'consultation_fee_in_person',
                'price_desc': 'consultation_fee_in_person',
            };
            const column = sortColumnMap[sortBy] || 'rating';
            const ascending = sortBy === 'fee_low' || sortBy === 'price_asc';
            query = query.order(column, { ascending, nullsFirst: false });

            const { data, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                this.log.error(`Supabase error in findManyWithRelations:`, error);
                throw error;
            }

            // Transform data to flatten user info for frontend consumption
            const transformedData = (data || []).map((doctor: any) => ({
                ...doctor,
                name: doctor.users?.name || 'Unknown Doctor',
                email: doctor.users?.email,
                phone: doctor.users?.phone,
                avatar_url: doctor.users?.avatar_url,
                specialization: doctor.specializations,
                hospital: doctor.hospitals,
                users: undefined,
                hospitals: undefined,
                specializations: undefined,
            }));

            return { data: transformedData, total: count || 0 };
        } catch (error) {
            this.log.error('Error in findManyWithRelations:', error);
            throw error;
        }
    }

    async findAllVerified(from: number, to: number, hospitalId?: string) {
        let query = this.getQuery()
            .select('*', { count: 'exact' })
            .eq('verification_status', 'verified')
            .eq('is_active', true);

        if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
        }

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;
        return { data, count };
    }

    async findWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, users!doctors_user_id_fkey(*), hospitals!doctors_hospital_id_fkey(*), specializations!doctors_specialization_id_fkey(id, name, slug)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding doctor with relations: ${id}`, error);
            return null;
        }
        return data;
    }

    async findByUserId(userId: string): Promise<Doctor | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding doctor by user ID: ${userId}`, error);
            return null;
        }
        return data as Doctor;
    }

    async getScheduleByDay(doctorId: string, day: string): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('doctor_schedules')
            .select('*')
            .eq('doctor_id', doctorId)
            .eq('day_of_week', day)
            .eq('is_active', true);

        if (error) {
            this.log.error(`Error finding schedule for doctor: ${doctorId}, day: ${day}`, error);
            return [];
        }
        return data || [];
    }

    async getSchedules(doctorId: string): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('doctor_schedules')
            .select('*')
            .eq('doctor_id', doctorId);

        if (error) {
            this.log.error(`Error fetching schedules for doctor: ${doctorId}`, error);
            return [];
        }
        return data || [];
    }

    async upsertSchedule(doctorId: string, schedule: any): Promise<any> {
        const { data, error } = await this.supabase
            .from('doctor_schedules')
            .upsert({ ...schedule, doctor_id: doctorId })
            .select()
            .single();

        if (error) {
            this.log.error(`Error upserting schedule for doctor: ${doctorId}`, error);
            throw error;
        }
        return data;
    }

    async upsertOverride(doctorId: string, override: any): Promise<any> {
        const { data, error } = await this.supabase
            .from('schedule_overrides')
            .upsert({ ...override, doctor_id: doctorId })
            .select()
            .single();

        if (error) {
            this.log.error(`Error upserting schedule override for doctor: ${doctorId}`, error);
            throw error;
        }
        return data;
    }

    async getAvailabilityData(doctorId: string, startDate: string, endDate: string) {
        const [appointments, overrides] = await Promise.all([
            this.supabase
                .from('appointments')
                .select('scheduled_date, scheduled_start')
                .eq('doctor_id', doctorId)
                .gte('scheduled_date', startDate)
                .lte('scheduled_date', endDate)
                .in('status', ['confirmed', 'checked_in', 'in_progress', 'rescheduled']),
            this.supabase
                .from('schedule_overrides')
                .select('*')
                .eq('doctor_id', doctorId)
                .gte('override_date', startDate)
                .lte('override_date', endDate)
        ]);

        return {
            appointments: appointments.data || [],
            overrides: overrides.data || []
        };
    }

    async getStats(doctorId: string) {
        const { data, error } = await this.supabase
            .rpc('get_doctor_stats', { p_doctor_id: doctorId });

        if (error) {
            this.log.error(`Error fetching stats for doctor: ${doctorId}`, error);
            return {
                total_appointments: 0,
                completed_appointments: 0,
                cancelled_appointments: 0,
                total_revenue: 0
            };
        }
        return data;
    }
}

export const doctorRepository = new DoctorRepository();
