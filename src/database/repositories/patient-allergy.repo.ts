import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface PatientAllergyRow {
    id: string;
    patient_id: string;
    family_member_id: string | null;
    allergen: string;
    allergen_type: 'drug' | 'food' | 'environmental' | 'insect' | 'latex' | 'other';
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    reaction: string | null;
    onset_date: string | null;
    diagnosed_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Patient Allergy Repository
 */
export class PatientAllergyRepository extends BaseRepository<PatientAllergyRow> {
    constructor() {
        super('patient_allergies');
    }

    /**
     * Find active allergies for a patient
     */
    async findActiveByPatient(patientId: string, familyMemberId?: string): Promise<PatientAllergyRow[]> {
        let query = this.getQuery()
            .select('*')
            .eq('patient_id', patientId)
            .eq('is_active', true)
            .order('severity', { ascending: true }) // life_threatening first
            .order('allergen', { ascending: true });

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
     * Find all allergies for a patient (including inactive)
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
     * Check if a specific allergen is recorded for a patient
     */
    async hasAllergen(patientId: string, allergen: string): Promise<boolean> {
        const { data, error } = await this.getQuery()
            .select('id')
            .eq('patient_id', patientId)
            .ilike('allergen', allergen)
            .eq('is_active', true)
            .limit(1);

        if (error) throw error;
        return (data?.length || 0) > 0;
    }

    /**
     * Deactivate an allergy
     */
    async deactivate(id: string) {
        return this.update(id, { is_active: false } as any);
    }

    /**
     * Find drug allergies specifically (for prescription safety checks)
     */
    async findDrugAllergies(patientId: string, familyMemberId?: string): Promise<PatientAllergyRow[]> {
        let query = this.getQuery()
            .select('*')
            .eq('patient_id', patientId)
            .eq('allergen_type', 'drug')
            .eq('is_active', true);

        if (familyMemberId) {
            query = query.eq('family_member_id', familyMemberId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
}

export const patientAllergyRepository = new PatientAllergyRepository();
