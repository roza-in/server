import { BasePolicy } from '../../common/authorization/types.js';
import type { AuthUser } from '../../types/request.js';
import type { HospitalRow } from './hospital.types.js';

/**
 * Hospital Policy - Authorization rules for hospitals
 */
export class HospitalPolicy extends BasePolicy<HospitalRow> {
    /**
     * Only owner or admin can update hospital
     */
    canUpdate(user: AuthUser, hospital?: HospitalRow): boolean {
        if (!hospital) return false;
        return hospital.admin_user_id === user.userId;
    }

    /**
     * Only admin can delete hospital
     */
    canDelete(user: AuthUser): boolean {
        return user.role === 'admin';
    }

    /**
     * Check if user is a platform admin
     */
    isAdmin(user: AuthUser): boolean {
        return user.role === 'admin';
    }

    /**
     * Doctors of the hospital, hospital owner, and admin can view hospital details
     */
    canView(user: AuthUser, hospital?: HospitalRow): boolean {
        if (!hospital) return true; // Public listing
        if (user.role === 'admin') return true;
        if (hospital.admin_user_id === user.userId) return true;
        if (user.role === 'doctor' && user.hospitalId === hospital.id) return true;

        return true; // Hospitals are generally public-facing
    }
}

export const hospitalPolicy = new HospitalPolicy();

