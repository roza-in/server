
export enum NotificationChannel {
    Email = "email",
    SMS = "sms",
    WhatsApp = "whatsapp",
}

export interface NotificationPayload {
    purpose: NotificationPurpose;
    channel?: NotificationChannel;
    phone?: string;
    email?: string;
    variables: Record<string, string>;
}

export interface NotificationTemplate {
    email?: {
        subject: string;
        body: string;
    };
    sms?: string;
    whatsapp?: string;
}

export type NotificationTemplateRegistry = {
    [key in NotificationPurpose]: NotificationTemplate;
};

export enum NotificationPurpose {
    OTP_LOGIN = "otp_login",
    OTP_REGISTRATION = "otp_registration",
    WELCOME_PATIENT = "welcome_patient",
    PATIENT_VERIFICATION_FAILED = "patient_verification_failed",
    HOSPITAL_REGISTRATION_SUBMITTED = "hospital_registration_submitted",
    HOSPITAL_VERIFICATION_APPROVED = "hospital_verification_approved",
    HOSPITAL_VERIFICATION_REJECTED = "hospital_verification_rejected",
    WELCOME_HOSPITAL = "welcome_hospital",
    WELCOME_DOCTOR = "welcome_doctor",
    DOCTOR_VERIFICATION_APPROVED = "doctor_verification_approved",
    DOCTOR_VERIFICATION_REJECTED = "doctor_verification_rejected",
    APPOINTMENT_CONFIRMED = "appointment_confirmed",
    APPOINTMENT_REMINDER = "appointment_reminder",
    APPOINTMENT_CANCELLED = "appointment_cancelled",
    APPOINTMENT_RESCHEDULED = "appointment_rescheduled",
    PAYMENT_SUCCESS = "payment_success",
    CONSULTATION_STARTED = "consultation_started",
    CONSULTATION_LINK = "consultation_link",
    PRESCRIPTION_READY = "prescription_ready",
    MEDICINE_ORDER_CONFIRMATION = "medicine_order_confirmation",
    GENERAL = "general",
}



