import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface HospitalAnnouncementRow {
    id: string;
    hospital_id: string;
    created_by: string;
    title: string;
    content: string;
    type: 'general' | 'holiday' | 'schedule_change' | 'emergency' | 'offer';
    is_public: boolean;
    is_active: boolean;
    starts_at: string;
    expires_at: string | null;
    target_roles: string[];
    created_at: string;
    updated_at: string;
}

/**
 * Hospital Announcement Repository
 */
export class HospitalAnnouncementRepository extends BaseRepository<HospitalAnnouncementRow> {
    constructor() {
        super('hospital_announcements');
    }

    /**
     * Find active announcements for a hospital
     */
    async findActive(hospitalId: string): Promise<HospitalAnnouncementRow[]> {
        const now = new Date().toISOString();
        const { data, error } = await this.getQuery()
            .select('*, creator:users!hospital_announcements_created_by_fkey(id, name)')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .lte('starts_at', now)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Find public announcements (visible to patients)
     */
    async findPublic(hospitalId: string): Promise<HospitalAnnouncementRow[]> {
        const now = new Date().toISOString();
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('is_active', true)
            .eq('is_public', true)
            .lte('starts_at', now)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Find all announcements for a hospital (admin view, including expired)
     */
    async findAllByHospital(hospitalId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*, creator:users!hospital_announcements_created_by_fkey(id, name)', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Deactivate an announcement
     */
    async deactivate(id: string) {
        return this.update(id, { is_active: false } as any);
    }
}

export const hospitalAnnouncementRepository = new HospitalAnnouncementRepository();
