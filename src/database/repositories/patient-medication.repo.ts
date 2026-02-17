import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface PatientMedicationRow {
    id: string;
    patient_id: string;
    family_member_id: string | null;
    medication_name: string;
    generic_name: string | null;
    dosage: string | null;
    frequency: string | null;
    route: string | null;
    prescribed_by: string | null;
    prescription_id: string | null;
    start_date: string;
    end_date: string | null;
    reason: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Patient Medication Repository - Ongoing medication tracking
 */
export class PatientMedicationRepository extends BaseRepository<PatientMedicationRow> {
    constructor() {
        super('patient_medications');
    }

    /**
     * Find active medications for a patient
     */
    async findActiveByPatient(patientId: string, familyMemberId?: string): Promise<PatientMedicationRow[]> {
        let query = this.getQuery()
            .select('*, prescriber:doctors!patient_medications_prescribed_by_fkey(*, users!doctors_user_id_fkey(name))')
            .eq('patient_id', patientId)
            .eq('is_active', true)
            .order('start_date', { ascending: false });

        if (familyMemberId) {
            query = query.eq('family_member_id', familyMemberId);
        } else {
            query = query.is('family_member_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    /**
     * Find all medications for a patient (including inactive)
     */
    async findAllByPatient(patientId: string, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('is_active', { ascending: false })
            .order('start_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Discontinue a medication
     */
    async discontinue(id: string) {
        return this.update(id, {
            is_active: false,
            end_date: new Date().toISOString().split('T')[0],
        } as any);
    }

    /**
     * Find medications from a specific prescription
     */
    async findByPrescription(prescriptionId: string): Promise<PatientMedicationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('prescription_id', prescriptionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }
}

export const patientMedicationRepository = new PatientMedicationRepository();
