import { AuthUser } from '../../types/request.js';

/**
 * Appointment Policy - Centralized authorization for appointments
 */
class AppointmentPolicy {
    /**
     * Check if user can view an appointment
     */
    canView(user: AuthUser, appointment: any): boolean {
        if (user.role === 'admin') return true;

        // Patient can view their own appointments
        if (user.role === 'patient') {
            return appointment.patient_id === user.userId;
        }

        // Doctor can view appointments booked with them
        if (user.role === 'doctor') {
            return appointment.doctor_id === user.doctorId;
        }

        // Hospital or reception can view appointments at their facility
        if (user.role === 'hospital' || user.role === 'reception') {
            return appointment.hospital_id === user.hospitalId;
        }

        return false;
    }

    /**
     * Check if user can create an appointment
     */
    canCreate(user: AuthUser): boolean {
        // Admins, Patients and Hospital staff can create appointments
        return ['admin', 'patient', 'hospital'].includes(user.role);
    }

    /**
     * Check if user can update an appointment
     */
    canUpdate(user: AuthUser, appointment: any): boolean {
        if (user.role === 'admin') return true;

        // Patients can only update (reschedule/cancel) their own
        if (user.role === 'patient') {
            return appointment.patient_id === user.userId;
        }

        // Doctors can update appointments booked with them
        if (user.role === 'doctor') {
            return appointment.doctor_id === user.doctorId;
        }

        // Hospitals or reception can update appointments at their facility
        if (user.role === 'hospital' || user.role === 'reception') {
            return appointment.hospital_id === user.hospitalId;
        }

        return false;
    }

    /**
     * Check if user can delete/cancel an appointment
     */
    canDelete(user: AuthUser, appointment: any): boolean {
        return this.canUpdate(user, appointment);
    }

    /**
     * Check if user is an admin
     */
    isAdmin(user: AuthUser): boolean {
        return user.role === 'admin';
    }
}

export const appointmentPolicy = new AppointmentPolicy();

