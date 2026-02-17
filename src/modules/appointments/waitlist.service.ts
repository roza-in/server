import { waitlistRepository, WaitlistRow } from '../../database/repositories/waitlist.repo.js';
import { appointmentRepository } from '../../database/repositories/appointment.repo.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import { logger } from '../../config/logger.js';

/**
 * Waitlist Service — manages appointment_waitlist for slot notifications
 */
class WaitlistService {
    private log = logger.child('WaitlistService');

    /**
     * Join a waitlist for a doctor+date slot
     */
    async joinWaitlist(
        patientId: string,
        doctorId: string,
        hospitalId: string,
        consultationType: string,
        preferredDate: string,
        preferredTimeStart?: string,
        preferredTimeEnd?: string,
        notes?: string,
    ): Promise<WaitlistRow> {
        // Check for duplicate entry
        const existing = await waitlistRepository.findOne({
            patient_id: patientId,
            doctor_id: doctorId,
            preferred_date: preferredDate,
            status: 'waiting',
        } as any) as WaitlistRow | null;

        if (existing) {
            throw new BadRequestError('You are already on the waitlist for this doctor and date');
        }

        const expiresAt = new Date(preferredDate);
        expiresAt.setDate(expiresAt.getDate() + 1); // Expire day after preferred date

        const entry = await waitlistRepository.create({
            patient_id: patientId,
            doctor_id: doctorId,
            hospital_id: hospitalId,
            consultation_type: consultationType,
            preferred_date: preferredDate,
            preferred_time_start: preferredTimeStart || null,
            preferred_time_end: preferredTimeEnd || null,
            status: 'waiting',
            notes: notes || null,
            expires_at: expiresAt.toISOString(),
        } as any);

        if (!entry) {
            throw new BadRequestError('Failed to join waitlist');
        }

        return entry;
    }

    /**
     * Get patient's waitlist entries
     */
    async getMyWaitlist(patientId: string, page = 1, limit = 20) {
        const result = await waitlistRepository.findByPatientId(patientId, page, limit);
        return {
            entries: result.data,
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    }

    /**
     * Cancel a waitlist entry
     */
    async cancelWaitlist(entryId: string, patientId: string): Promise<void> {
        const entry = await waitlistRepository.findById(entryId);
        if (!entry) {
            throw new NotFoundError('Waitlist entry');
        }
        if (entry.patient_id !== patientId) {
            throw new ForbiddenError('You can only cancel your own waitlist entries');
        }
        if (entry.status !== 'waiting') {
            throw new BadRequestError('Only waiting entries can be cancelled');
        }

        await waitlistRepository.update(entryId, { status: 'cancelled' } as any);
    }

    /**
     * Get waiting patients for a doctor+date (doctor/hospital use)
     */
    async getWaitingPatients(doctorId: string, date: string): Promise<WaitlistRow[]> {
        return waitlistRepository.findWaiting(doctorId, date);
    }

    /**
     * Expire old waitlist entries (called by scheduler)
     */
    async expireStale(): Promise<number> {
        return waitlistRepository.expireOld();
    }
}

export const waitlistService = new WaitlistService();
