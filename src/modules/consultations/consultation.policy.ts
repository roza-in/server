import { BasePolicy } from '../../common/authorization/types.js';
import type { AuthUser } from '../../types/request.js';

/**
 * Consultation Policy - Authorization rules for consultations
 * Note: Consultation table has NO doctor_id/patient_id/hospital_id columns.
 * These must be resolved from the joined appointment relation.
 */
export class ConsultationPolicy extends BasePolicy<any> {
    /**
     * Only treated patient, treating doctor or admin can view
     */
    canView(user: AuthUser, consultation?: any): boolean {
        if (user.role === 'admin') return true;
        if (!consultation) return false;

        // Get IDs from joined appointment or flattened response
        const patientId = consultation.appointment?.patient_id || consultation.patient?.id;
        const doctorUserId = consultation.appointment?.doctor?.user_id || consultation.doctor?.user_id;
        const doctorId = consultation.appointment?.doctor_id || consultation.doctor?.id;
        const hospitalId = consultation.appointment?.hospital_id;

        const isPatient = user.role === 'patient' && patientId === user.userId;
        const isDoctor = user.role === 'doctor' && (doctorUserId === user.userId || doctorId === user.doctorId);
        const isHospital = (user.role === 'hospital' || user.role === 'reception') && hospitalId === user.hospitalId;

        return isPatient || isDoctor || isHospital;
    }

    /**
     * Only treating doctor can update/end consultation
     */
    canUpdate(user: AuthUser, consultation?: any): boolean {
        if (!consultation) return false;
        const doctorUserId = consultation.appointment?.doctor?.user_id || consultation.doctor?.user_id;
        const doctorId = consultation.appointment?.doctor_id || consultation.doctor?.id;
        return user.role === 'doctor' && (doctorUserId === user.userId || doctorId === user.doctorId);
    }

    /**
     * Only treating doctor can create prescription
     */
    canCreatePrescription(user: AuthUser, consultation?: any): boolean {
        if (!consultation) return false;
        const doctorUserId = consultation.appointment?.doctor?.user_id || consultation.doctor?.user_id;
        const doctorId = consultation.appointment?.doctor_id || consultation.doctor?.id;
        return user.role === 'doctor' && (doctorUserId === user.userId || doctorId === user.doctorId);
    }
}

export const consultationPolicy = new ConsultationPolicy();

