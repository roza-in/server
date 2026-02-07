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
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('slug', slug)
            .single();

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

        if (doctorsError) throw doctorsError;

        // Count unique patients (placeholder logic for now, ideally strictly distinct query)
        // For speed, just using appointment count proxy or 0 for now if distinct is expensive without RPC
        const patientsSeen = 0;

        return {
            totalDoctors: doctorsCount || 0,
            activeDoctors: doctorsCount || 0, // Assuming all are active for now
            totalAppointments: totalAppointments || 0,
            todayAppointments: todayAppointments || 0,
            completedAppointments: completedAppointments || 0,
            cancelledAppointments: cancelledAppointments || 0,
            pendingAppointments: pendingAppointments || 0,
            activeAppointments: activeAppointments || 0,
            totalRevenue: 0, // Placeholder
            monthlyRevenue: 0, // Placeholder
            totalPatients: patientsSeen,
            averageRating: 0,
            totalReviews: 0,
            pendingSettlement: 0
        };
    }

    async findBySlugWithDoctors(slug: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, doctors(*, users(*))')
            .eq('slug', slug)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    async findPatients(hospitalId: string, filters: any = {}) {
        // This usually involves joining appointments and users
        const { data, error, count } = await this.supabase
            .from('appointments')
            .select('patient:patient_id(*)', { count: 'exact' })
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        // Deduplicate patients in application logic or use a better query
        const patients = Array.from(new Set(data?.map(a => JSON.stringify(a.patient))))
            .map(p => JSON.parse(p));

        return { patients, total: count || 0 };
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
        const { data, error, count } = await this.supabase
            .from('payments')
            .select('*, patient:patient_id(*)', { count: 'exact' })
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        return { payments: data, total: count || 0 };
    }

    async findInvoices(hospitalId: string, filters: any = {}) {
        const { data, error, count } = await this.supabase
            .from('invoices')
            .select('*', { count: 'exact' })
            .eq('hospital_id', hospitalId);

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
}

export const hospitalRepository = new HospitalRepository();
