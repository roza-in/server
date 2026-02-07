import { BasePolicy } from '../../common/authorization/types.js';
import type { AuthUser } from '../../types/request.js';

/**
 * Consultation Policy - Authorization rules for consultations
 */
export class ConsultationPolicy extends BasePolicy<any> {
    /**
     * Only treated patient, treating doctor or admin can view
     */
    canView(user: AuthUser, consultation?: any): boolean {
        if (user.role === 'admin') return true;
        if (!consultation) return false;

        const isPatient = user.role === 'patient' && consultation.patient_id === user.userId;
        const isDoctor = user.role === 'doctor' && (consultation.doctor?.user_id === user.userId || consultation.doctor_id === user.userId);
        const isHospital = user.role === 'hospital' && consultation.hospital_id === user.hospitalId;

        return isPatient || isDoctor || isHospital;
    }

    /**
     * Only treating doctor can update/end consultation
     */
    canUpdate(user: AuthUser, consultation?: any): boolean {
        if (!consultation) return false;
        return user.role === 'doctor' && (consultation.doctor?.user_id === user.userId || consultation.doctor_id === user.userId);
    }

    /**
     * Only treating doctor can create prescription
     */
    canCreatePrescription(user: AuthUser, consultation?: any): boolean {
        if (!consultation) return false;
        return user.role === 'doctor' && (consultation.doctor?.user_id === user.userId || consultation.doctor_id === user.userId);
    }
}

export const consultationPolicy = new ConsultationPolicy();

