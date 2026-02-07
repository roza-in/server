import { BasePolicy } from '../../common/authorization/types.js';
import type { AuthUser } from '../../types/request.js';
import { ForbiddenError } from '../../common/errors/index.js';

export class PaymentPolicy extends BasePolicy<any> {

    private isAdmin(user: AuthUser): boolean {
        return user.role === 'admin';
    }

    /**
     * Check if user can create an order for an appointment
     */
    canCreateOrder(user: AuthUser, patientId: string): boolean {
        // Only the patient themselves can create a payment order for their appointment
        return user.userId === patientId;
    }

    /**
     * Check if user can verify payment
     */
    canVerifyPayment(user: AuthUser, patientId: string): boolean {
        return user.userId === patientId;
    }

    /**
     * Check if user can view payment details
     */
    canViewPayment(user: AuthUser, payment: { payer_user_id: string; doctor_id?: string | null; hospital_id?: string | null }): boolean {
        if (this.isAdmin(user)) return true;

        // Patient can view their own payments
        if (user.role === 'patient' && user.userId === payment.payer_user_id) return true;

        // Doctor can view payments for their appointments
        if (user.role === 'doctor' && payment.doctor_id && user.userId === payment.doctor_id) return true;

        if (user.role === 'doctor' && user.doctorId === payment.doctor_id) return true;

        // Hospital can view payments for their appointments
        if (user.role === 'hospital' && user.hospitalId === payment.hospital_id) return true;

        return false;
    }

    /**
     * Check if user can list payments
     */
    canListPayments(user: AuthUser, filters: { patient_id?: string; doctor_id?: string; hospital_id?: string }): boolean {
        if (this.isAdmin(user)) return true;

        // Users can only list their own payments
        if (user.role === 'patient' && filters.patient_id === user.userId) return true;
        if (user.role === 'doctor' && filters.doctor_id === user.doctorId) return true;
        if (user.role === 'hospital' && filters.hospital_id === user.hospitalId) return true;

        return false;
    }

    /**
     * Check if user can refund a payment
     */
    canRefundPayment(user: AuthUser, payment: { hospital_id?: string | null }): boolean {
        if (this.isAdmin(user)) return true;

        // Only admins usually process refunds, but maybe hospitals can initiate?
        // Based on requirements, refunds might be admin only or hospital initiated.
        // Let's allow hospital to initiate refund for their own payments.
        if (user.role === 'hospital' && user.hospitalId === payment.hospital_id) return true;

        throw new ForbiddenError('You are not authorized to refund this payment');
    }

    /**
     * Check if user can view settlements
     */
    canViewSettlements(user: AuthUser, hospitalId?: string): boolean {
        if (this.isAdmin(user)) return true;
        if (user.role === 'hospital' && user.hospitalId === hospitalId) return true;

        return false;
    }

    /**
     * Check if user can create settlement
     */
    canManageSettlements(user: AuthUser): boolean {
        return this.isAdmin(user);
    }
}

export const paymentPolicy = new PaymentPolicy();

