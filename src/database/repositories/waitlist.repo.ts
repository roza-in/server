import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface WaitlistRow {
    id: string;
    patient_id: string;
    doctor_id: string;
    hospital_id: string;
    consultation_type: string;
    preferred_date: string;
    preferred_time_start: string | null;
    preferred_time_end: string | null;
    status: 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled';
    notified_at: string | null;
    booked_appointment_id: string | null;
    expires_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Waitlist Repository - Appointment waitlist operations
 */
export class WaitlistRepository extends BaseRepository<WaitlistRow> {
    constructor() {
        super('appointment_waitlist');
    }

    /**
     * Find active waitlist entries for a doctor + date
     */
    async findWaiting(doctorId: string, date: string): Promise<WaitlistRow[]> {
        const { data, error } = await this.getQuery()
            .select('*, patient:users!appointment_waitlist_patient_id_fkey(id, name, phone, email)')
            .eq('doctor_id', doctorId)
            .eq('preferred_date', date)
            .eq('status', 'waiting')
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Find waitlist entries by patient
     */
    async findByPatientId(patientId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*, doctor:doctors!appointment_waitlist_doctor_id_fkey(*, users!doctors_user_id_fkey(name, avatar_url)), hospital:hospitals(name)', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Mark entry as notified
     */
    async markNotified(id: string) {
        return this.update(id, {
            status: 'notified',
            notified_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Mark entry as booked
     */
    async markBooked(id: string, appointmentId: string) {
        return this.update(id, {
            status: 'booked',
            booked_appointment_id: appointmentId,
        } as any);
    }

    /**
     * Expire old waitlist entries
     */
    async expireOld(): Promise<number> {
        const { data, error } = await this.supabase
            .from('appointment_waitlist')
            .update({ status: 'expired' })
            .eq('status', 'waiting')
            .lt('expires_at', new Date().toISOString())
            .select('id');

        if (error) throw error;
        return data?.length || 0;
    }
}

export const waitlistRepository = new WaitlistRepository();
