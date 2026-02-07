import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface SpecializationRow {
    id: string;
    name: string;
    icon_url: string | null;
    created_at: string;
}

/**
 * Specialization Repository - Database operations for medical specializations
 */
export class SpecializationRepository extends BaseRepository<SpecializationRow> {
    constructor() {
        super('specializations');
    }

    /**
     * List all specializations ordered by name
     */
    async listAll(): Promise<SpecializationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            this.log.error('Failed to fetch specializations', error);
            throw error;
        }

        return data || [];
    }
}

export const specializationRepository = new SpecializationRepository();
