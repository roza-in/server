import { hospitalAnnouncementRepository, HospitalAnnouncementRow } from '../../database/repositories/hospital-announcement.repo.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import { logger } from '../../config/logger.js';

/**
 * Announcement Service — manages hospital_announcements
 */
class AnnouncementService {
    private log = logger.child('AnnouncementService');

    /**
     * Create a new announcement
     */
    async create(
        hospitalId: string,
        createdBy: string,
        data: {
            title: string;
            content: string;
            type?: string;
            isPublic?: boolean;
            startsAt?: string;
            expiresAt?: string;
            targetRoles?: string[];
        }
    ): Promise<HospitalAnnouncementRow> {
        const announcement = await hospitalAnnouncementRepository.create({
            hospital_id: hospitalId,
            created_by: createdBy,
            title: data.title,
            content: data.content,
            type: (data.type as any) || 'general',
            is_public: data.isPublic ?? false,
            is_active: true,
            starts_at: data.startsAt || new Date().toISOString(),
            expires_at: data.expiresAt || null,
            target_roles: data.targetRoles || [],
        } as any);

        if (!announcement) {
            throw new BadRequestError('Failed to create announcement');
        }

        return announcement;
    }

    /**
     * Get active announcements for a hospital (staff view)
     */
    async getActive(hospitalId: string): Promise<HospitalAnnouncementRow[]> {
        return hospitalAnnouncementRepository.findActive(hospitalId);
    }

    /**
     * Get public announcements (patient-facing)
     */
    async getPublic(hospitalId: string): Promise<HospitalAnnouncementRow[]> {
        return hospitalAnnouncementRepository.findPublic(hospitalId);
    }

    /**
     * Get all announcements with pagination (admin/hospital view)
     */
    async getAll(hospitalId: string, page = 1, limit = 20) {
        const result = await hospitalAnnouncementRepository.findAllByHospital(hospitalId, page, limit);
        return {
            announcements: result.data,
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    }

    /**
     * Update an announcement
     */
    async update(
        announcementId: string,
        hospitalId: string,
        updates: Partial<Pick<HospitalAnnouncementRow, 'title' | 'content' | 'type' | 'is_public' | 'expires_at' | 'target_roles'>>
    ): Promise<HospitalAnnouncementRow> {
        const existing = await hospitalAnnouncementRepository.findById(announcementId);
        if (!existing) throw new NotFoundError('Announcement');
        if (existing.hospital_id !== hospitalId) throw new ForbiddenError('Announcement belongs to another hospital');

        const updated = await hospitalAnnouncementRepository.update(announcementId, updates as any);
        if (!updated) throw new BadRequestError('Failed to update announcement');
        return updated;
    }

    /**
     * Deactivate an announcement
     */
    async deactivate(announcementId: string, hospitalId: string): Promise<void> {
        const existing = await hospitalAnnouncementRepository.findById(announcementId);
        if (!existing) throw new NotFoundError('Announcement');
        if (existing.hospital_id !== hospitalId) throw new ForbiddenError('Announcement belongs to another hospital');

        await hospitalAnnouncementRepository.deactivate(announcementId);
    }
}

export const announcementService = new AnnouncementService();
