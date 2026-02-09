/**
 * Reception Module Types
 */

export interface QueueAppointment {
    id: string;
    appointmentNumber: string;
    patient: {
        id: string;
        name: string;
        phone: string | null;
        avatarUrl: string | null;
    };
    doctor: {
        id: string;
        name: string;
        specialization: string;
    };
    scheduledStart: string;
    scheduledEnd: string;
    startTime?: string;
    endTime?: string;
    status: string;
    consultationType: string;
    checkedInAt: string | null;
    checkedInAtFormatted?: string | null;
    scheduledStartFormatted?: string;
    consultationFee?: number;
    paymentCollectedAt?: string | null;
}

export interface QueueResponse {
    appointments: QueueAppointment[];
    stats: {
        total: number;
        confirmed: number;
        checkedIn: number;
        inProgress: number;
        completed: number;
        noShow: number;
        cancelled: number;
    };
}

export interface WalkInBookingInput {
    doctorId: string;
    slotId?: string;
    scheduledDate: string;
    scheduledStart: string;
    patient: {
        id?: string; // If existing patient
        name: string;
        phone: string;
        email?: string;
        dateOfBirth?: string;
        gender?: 'male' | 'female' | 'other';
    };
    consultationFee: number;
    paymentMethod: 'cash';
    notes?: string;
}

export interface PatientSearchResult {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    lastVisit: string | null;
    totalVisits: number;
}

export interface CashPaymentInput {
    appointmentId: string;
    amount: number;
    receiptNumber?: string;
}
