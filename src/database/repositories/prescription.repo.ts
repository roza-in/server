import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Prescription } from '../../types/database.types.js';

export class PrescriptionRepository extends BaseRepository<Prescription> {
    constructor() {
        super('prescriptions');
    }

    async findByConsultationId(consultationId: string): Promise<Prescription | null> {
        return this.findOne({ consultation_id: consultationId } as any);
    }

    override async findMany(filters: Record<string, any> = {}, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = this.getQuery().select(`
            *,
            patient:users!prescriptions_patient_id_fkey(id, name),
            doctor:doctors(id, users:users!doctors_user_id_fkey(name))
        `, { count: 'exact' });

        // Apply filters
        if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);
        if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id);
        if (filters.hospital_id) query = query.eq('hospital_id', filters.hospital_id);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error(`Error in PrescriptionRepository.findMany:`, error);
            throw error;
        }

        return { data: data || [], total: count || 0 };
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select(`
                *,
                doctor:doctors(
                    id,
                    registration_number,
                    specialization:specializations!doctors_specialization_id_fkey(name),
                    users:users!doctors_user_id_fkey(name)
                ),
                patient:users!prescriptions_patient_id_fkey(id, name),
                hospital:hospitals(*),
                consultation:consultations(*, appointment:appointments(*))
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding prescription by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    async findByPatientId(patientId: string, from: number, to: number) {
        const { data, error, count } = await this.getQuery()
            .select('*, doctors(users!doctors_user_id_fkey(name))', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data, count };
    }

    // ============================================================================
    // Prescription → Pharmacy Order Flow
    // ============================================================================

    /**
     * Mark a prescription as medicine-ordered and link the order
     */
    async markMedicineOrdered(prescriptionId: string, orderId: string) {
        return this.update(prescriptionId, {
            medicine_ordered: true,
            medicine_order_id: orderId,
        } as any);
    }

    /**
     * Find prescriptions with orderable medicines (not yet ordered)
     */
    async findUnorderedByPatient(patientId: string) {
        const { data, error } = await this.getQuery()
            .select('*, doctors(users!doctors_user_id_fkey(name)), hospitals(name)')
            .eq('patient_id', patientId)
            .eq('medicine_ordered', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Get prescription with its linked medicine order
     */
    async findByIdWithOrder(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, doctors(users!doctors_user_id_fkey(name)), hospitals(name), medicine_order:medicine_orders!fk_prescriptions_medicine_order(*)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }
}

export const prescriptionRepository = new PrescriptionRepository();
