import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface PatientConditionRow {
    id: string;
    patient_id: string;
    family_member_id: string | null;
    condition_name: string;
    icd_code: string | null;
    severity: 'mild' | 'moderate' | 'severe' | 'critical';
    status: 'active' | 'resolved' | 'chronic' | 'in_remission';
    diagnosed_date: string | null;
    diagnosed_by: string | null;
    resolved_date: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Patient Medical Condition Repository
 */
export class PatientConditionRepository extends BaseRepository<PatientConditionRow> {
    constructor() {
        super('patient_medical_conditions');
    }

    /**
     * Find active conditions for a patient
     */
    async findActiveByPatient(patientId: string, familyMemberId?: string): Promise<PatientConditionRow[]> {
        let query = this.getQuery()
            .select('*')
            .eq('patient_id', patientId)
            .eq('is_active', true)
            .order('severity', { ascending: true })
            .order('condition_name', { ascending: true });

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
     * Find all conditions for a patient (including resolved)
     */
    async findAllByPatient(patientId: string, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Find chronic conditions for a patient
     */
    async findChronic(patientId: string): Promise<PatientConditionRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('patient_id', patientId)
            .eq('status', 'chronic')
            .eq('is_active', true)
            .order('condition_name', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Mark condition as resolved
     */
    async markResolved(id: string) {
        return this.update(id, {
            status: 'resolved',
            resolved_date: new Date().toISOString().split('T')[0],
            is_active: false,
        } as any);
    }

    /**
     * Find by ICD code (for analytics/reporting)
     */
    async findByIcdCode(icdCode: string, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*, patient:users!patient_medical_conditions_patient_id_fkey(id, name)', { count: 'exact' })
            .eq('icd_code', icdCode)
            .eq('is_active', true)
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Get a patient's complete medical summary (conditions + active status)
     */
    async getMedicalSummary(patientId: string) {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('patient_id', patientId)
            .eq('is_active', true);

        if (error) throw error;

        const conditions = data || [];
        return {
            active: conditions.filter(c => c.status === 'active'),
            chronic: conditions.filter(c => c.status === 'chronic'),
            inRemission: conditions.filter(c => c.status === 'in_remission'),
            total: conditions.length,
        };
    }
}

export const patientConditionRepository = new PatientConditionRepository();
