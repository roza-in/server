import { BasePolicy } from '../../common/authorization/types.js';
import type { AuthUser } from '../../types/request.js';
import type { DoctorRow } from './doctor.types.js';

/**
 * Doctor Policy - Authorization rules for doctors
 */
export class DoctorPolicy extends BasePolicy<DoctorRow> {
    /**
     * Only owner or admin can update doctor profile
     */
    canUpdate(user: AuthUser, doctor?: { user_id: string }): boolean {
        if (!doctor) return false;
        return doctor.user_id === user.userId;
    }

    /**
     * Only hospital admin or platform admin can delete/deactivate doctor
     */
    canDelete(user: AuthUser, doctor?: { hospital_id?: string | null }): boolean {
        if (user.role === 'admin') return true;
        if (!doctor) return false;
        return user.role === 'hospital' && user.hospitalId === doctor.hospital_id;
    }

    /**
     * Doctors, hospital owners, and admin can view doctor details
     */
    canView(user: AuthUser, doctor?: any): boolean {
        // Doctors are generally public-facing
        return true;
    }

    /**
     * Only hospital admin or platform admin can create a doctor record
     */
    canCreate(user: AuthUser): boolean {
        return user.role === 'admin' || user.role === 'hospital';
    }
}

export const doctorPolicy = new DoctorPolicy();

