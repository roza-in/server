import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface HospitalVerificationRow {
    id: string;
    hospital_id: string;
    requested_by: string;
    registration_certificate_url: string | null;
    license_url: string | null;
    gstin_certificate_url: string | null;
    photos: string[] | null;
    additional_documents: any | null;
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    review_notes: string | null;
    resubmission_count: number;
    previous_request_id: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Hospital Verification Repository - Verification request management
 */
export class HospitalVerificationRepository extends BaseRepository<HospitalVerificationRow> {
    constructor() {
        super('hospital_verification_requests');
    }

    /**
     * Find latest verification request for a hospital
     */
    async findLatestByHospital(hospitalId: string): Promise<HospitalVerificationRow | null> {
        const { data, error } = await this.getQuery()
            .select('*, reviewer:users!hospital_verification_requests_reviewed_by_fkey(id, name)')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    /**
     * Find all pending verification requests (admin view)
     */
    async findPending(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*, hospital:hospitals(id, name, city, state), requester:users!hospital_verification_requests_requested_by_fkey(id, name)', { count: 'exact' })
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Approve a verification request
     */
    async approve(id: string, reviewedBy: string, notes?: string) {
        return this.update(id, {
            status: 'approved',
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
            review_notes: notes || null,
        } as any);
    }

    /**
     * Reject a verification request
     */
    async reject(id: string, reviewedBy: string, reason: string, notes?: string) {
        return this.update(id, {
            status: 'rejected',
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
            review_notes: notes || null,
        } as any);
    }

    /**
     * Find verification history for a hospital
     */
    async findByHospital(hospitalId: string) {
        const { data, error } = await this.getQuery()
            .select('*, reviewer:users!hospital_verification_requests_reviewed_by_fkey(id, name)')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
}

export const hospitalVerificationRepository = new HospitalVerificationRepository();
