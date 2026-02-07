import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Consultation } from '../../types/database.types.js';

export class ConsultationRepository extends BaseRepository<Consultation> {
    constructor() {
        super('consultations');
    }

    async findByAppointmentId(appointmentId: string): Promise<Consultation | null> {
        return this.findOne({ appointment_id: appointmentId } as any);
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select(`
                *,
                appointment:appointments(
                    *,
                    patient:users!appointments_patient_id_fkey(*),
                    doctor:doctors(*, users:users!doctors_user_id_fkey(*))
                ),
                prescriptions(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding consultation by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    override async findMany(filters: Record<string, any> = {}, page = 1, limit = 20): Promise<{ data: Consultation[]; total: number }> {
        const offset = (page - 1) * limit;

        // Use inner join for appointments to allow filtering
        let query = this.getQuery()
            .select(`
                *,
                appointment:appointments!inner(
                    *,
                    patient:users!appointments_patient_id_fkey(*),
                    doctor:doctors(*, users:users!doctors_user_id_fkey(*))
                ),
                prescriptions(*)
            `, { count: 'exact' });

        // Apply filters
        if (filters.patient_id) {
            query = query.eq('appointment.patient_id', filters.patient_id);
        }
        if (filters.doctor_id) {
            query = query.eq('appointment.doctor_id', filters.doctor_id);
        }
        if (filters.appointment_id || filters.appointmentId) {
            query = query.eq('appointment_id', filters.appointment_id || filters.appointmentId);
        }

        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        if (filters.startDate) {
            query = query.gte('appointment.scheduled_date', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('appointment.scheduled_date', filters.endDate);
        }

        const { data, error, count } = await query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) {
            this.log.error('Error in findMany consultations:', error);
            throw error;
        }

        return { data: data as any[], total: count || 0 };
    }
}

export const consultationRepository = new ConsultationRepository();
