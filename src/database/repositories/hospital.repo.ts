import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Hospital } from '../../types/database.types.js';

export class HospitalRepository extends BaseRepository<Hospital> {
    constructor() {
        super('hospitals');
    }

    async findAllVerified(from: number, to: number) {
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .eq('verification_status', 'verified')
            .eq('is_active', true)
            .range(from, to);

        if (error) throw error;
        return { data, count };
    }

    async findByAdminId(adminId: string): Promise<Hospital | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('admin_user_id', adminId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding hospital by admin ID: ${adminId}`, error);
            return null;
        }
        return data as Hospital;
    }

    async findBySlug(slug: string): Promise<Hospital | null> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

        const query = this.getQuery().select('*');
        if (isUuid) {
            query.eq('id', slug);
        } else {
            query.eq('slug', slug);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding hospital by slug: ${slug}`, error);
            return null;
        }
        return data as Hospital;
    }

    async findWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, admin:users!admin_user_id(*), doctors:doctors(count), appointments:appointments(count)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding hospital with relations by ID: ${id}`, error);
            return null;
        }

        return {
            ...data,
            totalDoctors: data.doctors?.[0]?.count || 0,
            totalAppointments: data.appointments?.[0]?.count || 0
        };
    }

    async findByUserId(userId: string): Promise<Hospital | null> {
        return this.findByAdminId(userId);
    }

    async getStats(hospitalId: string): Promise<any> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { error: doctorsError, count: doctorsCount } = await this.supabase
            .from('doctors')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId);

        const { count: totalAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId);

        const { count: todayAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString());

        // Calculate status counts
        const { count: completedAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            .eq('status', 'completed');

        const { count: cancelledAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            .eq('status', 'cancelled');

        const { count: pendingAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            .eq('status', 'pending');

        const { count: activeAppointments } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('hospital_id', hospitalId)
            // Assuming 'confirmed' or 'checked_in' counts as active/in-progress
            .in('status', ['confirmed', 'checked_in', 'in_progress']);

        // Revenue: sum of captured payments
        const { data: revenueData } = await this.supabase
            .from('payments')
            .select('amount')
            .eq('hospital_id', hospitalId)
            .eq('status', 'captured');

        const totalRevenue = (revenueData || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        // Monthly revenue
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const { data: monthlyRevenueData } = await this.supabase
            .from('payments')
            .select('amount')
            .eq('hospital_id', hospitalId)
            .eq('status', 'captured')
            .gte('created_at', monthStart);

        const monthlyRevenue = (monthlyRevenueData || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        // Ratings
        const { data: ratingData } = await this.supabase
            .from('ratings')
            .select('rating')
            .eq('hospital_id', hospitalId);

        const ratings = ratingData || [];
        const averageRating = ratings.length > 0
            ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
            : 0;

        if (doctorsError) throw doctorsError;

        return {
            totalDoctors: doctorsCount || 0,
            activeDoctors: doctorsCount || 0,
            totalAppointments: totalAppointments || 0,
            todayAppointments: todayAppointments || 0,
            completedAppointments: completedAppointments || 0,
            cancelledAppointments: cancelledAppointments || 0,
            pendingAppointments: pendingAppointments || 0,
            activeAppointments: activeAppointments || 0,
            totalRevenue,
            monthlyRevenue,
            totalPatients: completedAppointments || 0,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: ratings.length,
            pendingSettlement: 0,
        };
    }

    async findBySlugWithDoctors(slug: string): Promise<any | null> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

        const query = this.getQuery().select('*, doctors(*, users!doctors_user_id_fkey(*))');

        if (isUuid) {
            query.eq('id', slug);
        } else {
            query.eq('slug', slug);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    async findPatients(hospitalId: string, filters: any = {}) {
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 20;

        // 1. Fetch appointments to gather patient IDs and stats
        // We order by scheduled_date DESC to easily pick the latest visit
        const { data: appointments, error: aptError } = await this.supabase
            .from('appointments')
            .select('patient_id, scheduled_date')
            .eq('hospital_id', hospitalId)
            .order('scheduled_date', { ascending: false });

        if (aptError) {
            this.log.error(`Error fetching patient IDs for hospital ${hospitalId}`, aptError);
            throw aptError;
        }

        // 2. Aggregate stats per patient
        const patientStats = new Map<string, { lastVisit: string, totalVisits: number }>();
        (appointments || []).forEach(apt => {
            const existing = patientStats.get(apt.patient_id);
            if (!existing) {
                patientStats.set(apt.patient_id, {
                    lastVisit: apt.scheduled_date,
                    totalVisits: 1
                });
            } else {
                existing.totalVisits += 1;
            }
        });

        const distinctPatientIds = Array.from(patientStats.keys());
        const total = distinctPatientIds.length;

        // 3. Apply pagination to the distinct IDs
        const start = (page - 1) * limit;
        const paginatedIds = distinctPatientIds.slice(start, start + limit);

        if (paginatedIds.length === 0) {
            return { patients: [], total };
        }

        // 4. Fetch full user profiles for the paginated subset
        const { data: users, error: userError } = await this.supabase
            .from('users')
            .select('*')
            .in('id', paginatedIds);

        if (userError) {
            this.log.error(`Error fetching patient profiles for group ${paginatedIds}`, userError);
            throw userError;
        }

        // 5. Build final objects with aggregated stats
        // Sort back to match the latest-visit order from paginatedIds
        const patients = paginatedIds.map(id => {
            const user = users.find(u => u.id === id);
            const stats = patientStats.get(id);
            return {
                ...user,
                last_visit: stats?.lastVisit,
                total_visits: stats?.totalVisits
            };
        });

        return { patients, total };
    }

    async findAppointments(hospitalId: string, filters: any = {}) {
        let query = this.supabase
            .from('appointments')
            .select('*, patient:patient_id(*), doctor:doctor_id(*, users!doctors_user_id_fkey(*))', { count: 'exact' })
            .eq('hospital_id', hospitalId);

        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;
        if (error) throw error;
        return { appointments: data, total: count || 0 };
    }

    async findPayments(hospitalId: string, filters: any = {}) {
        let query = this.supabase
            .from('payments')
            .select('*, payer:payer_user_id(id, name, phone, email)', { count: 'exact' })
            .eq('hospital_id', hospitalId);

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.date_from) query = query.gte('created_at', filters.date_from);
        if (filters.date_to) query = query.lte('created_at', filters.date_to);

        query = query.order('created_at', { ascending: false });

        const { data, error, count } = await query;
        if (error) throw error;
        return { payments: data, total: count || 0 };
    }

    async findInvoices(hospitalId: string, filters: any = {}) {
        const { data, error, count } = await this.supabase
            .from('settlement_invoices')
            .select('*, settlement:settlements!inner(*)', { count: 'exact' })
            .eq('settlement.entity_type', 'hospital')
            .eq('settlement.entity_id', hospitalId);

        if (error) throw error;
        return { invoices: data, total: count || 0 };
    }

    async getRecentAppointments(hospitalId: string) {
        const { data, error } = await this.supabase
            .from('appointments')
            .select('*, patient:patient_id(*), doctor:doctor_id(*, users!doctors_user_id_fkey(*))')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data;
    }

    async getTopDoctors(hospitalId: string) {
        const { data, error } = await this.supabase
            .from('doctors')
            .select('*, users!doctors_user_id_fkey(*)')
            .eq('hospital_id', hospitalId)
            .limit(5);

        if (error) throw error;
        return data;
    }

    async getDoctors(hospitalId: string) {
        const { data, error } = await this.supabase
            .from('doctors')
            .select('*, users!doctors_user_id_fkey(*), specializations!doctors_specialization_id_fkey(id, name, slug)')
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        return data;
    }

    // ============================================================================
    // Staff Management
    // ============================================================================

    /**
     * Add staff member to hospital
     */
    async addStaff(hospitalId: string, userId: string, staffRole: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('hospital_staff')
            .insert({
                hospital_id: hospitalId,
                user_id: userId,
                staff_role: staffRole,
                can_book_appointments: true,
                can_mark_payments: true,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            this.log.error(`Error adding staff to hospital ${hospitalId}`, error);
            throw error;
        }
        return data;
    }

    /**
     * Get all staff members for a hospital
     */
    async getStaff(hospitalId: string): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('hospital_staff')
            .select('*, user:user_id(*)')
            .eq('hospital_id', hospitalId);

        if (error) {
            this.log.error(`Error fetching staff for hospital ${hospitalId}`, error);
            throw error;
        }

        return (data || []).map((s: any) => ({
            id: s.user_id,
            name: s.user?.name,
            phone: s.user?.phone,
            email: s.user?.email,
            staff_role: s.staff_role,
            can_book_appointments: s.can_book_appointments,
            can_mark_payments: s.can_mark_payments,
            is_active: s.user?.is_active,
            created_at: s.created_at,
        }));
    }

    /**
     * Remove staff member from hospital
     */
    async removeStaff(hospitalId: string, userId: string): Promise<void> {
        const { error } = await this.supabase
            .from('hospital_staff')
            .delete()
            .eq('hospital_id', hospitalId)
            .eq('user_id', userId);

        if (error) {
            this.log.error(`Error removing staff ${userId} from hospital ${hospitalId}`, error);
            throw error;
        }
    }

    /**
     * Check if user is linked to hospital as staff
     */
    async isStaffLinked(hospitalId: string, userId: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('hospital_staff')
            .select('user_id')
            .eq('hospital_id', hospitalId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            this.log.error(`Error checking staff linkage for ${userId} in ${hospitalId}`, error);
            return false;
        }
        return !!data;
    }
    /**
     * Get payout account details for hospital
     */
    async getPayoutAccount(hospitalId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('payout_accounts')
            .select('*')
            .eq('hospital_id', hospitalId)
            .maybeSingle();

        if (error) {
            this.log.error(`Error fetching payout account for hospital ${hospitalId}`, error);
            throw error;
        }
        return data;
    }

    /**
     * Update or create payout account
     */
    async updatePayoutAccount(hospitalId: string, data: any): Promise<any> {
        // Check if account exists
        const existing = await this.getPayoutAccount(hospitalId);

        let query;
        if (existing) {
            query = this.supabase
                .from('payout_accounts')
                .update({
                    ...data,
                    updated_at: new Date().toISOString()
                })
                .eq('hospital_id', hospitalId)
                .select()
                .single();
        } else {
            query = this.supabase
                .from('payout_accounts')
                .insert({
                    hospital_id: hospitalId,
                    ...data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
        }

        const { data: result, error } = await query;
        if (error) {
            this.log.error(`Error updating payout account for hospital ${hospitalId}`, error);
            throw error;
        }
        return result;
    }

    /**
     * Update hospital facilities
     */
    async updateFacilities(hospitalId: string, facilities: string[]): Promise<any> {
        const { data, error } = await this.supabase
            .from('hospitals')
            .update({
                facilities,
                updated_at: new Date().toISOString()
            } as any)
            .eq('id', hospitalId)
            .select('facilities')
            .single();

        if (error) {
            this.log.error(`Error updating facilities for hospital ${hospitalId}`, error);
            throw error;
        }
        return data;
    }
}

export const hospitalRepository = new HospitalRepository();
