import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Prescription } from '../../types/database.types.js';

export class PrescriptionRepository extends BaseRepository<Prescription> {
    constructor() {
        super('prescriptions');
    }

    async findByConsultationId(consultationId: string): Promise<Prescription | null> {
        return this.findOne({ consultation_id: consultationId } as any);
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, doctors(users!doctors_user_id_fkey(name)), appointments(*), hospitals(*)')
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
}

export const prescriptionRepository = new PrescriptionRepository();
