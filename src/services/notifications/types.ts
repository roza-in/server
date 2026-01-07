/**
 * Supported notification delivery channels
 */
export type NotificationChannel =
  | "whatsapp"
  | "sms"
  | "email";

/**
 * Business-level notification purposes
 * (Mapped to templates & channels)
 */
export type NotificationPurpose =
  // OTP
  | "OTP_LOGIN"
  | "OTP_REGISTRATION"

  // Patient
  | "WELCOME_PATIENT"
  | "PATIENT_VERIFICATION_FAILED"

  // Hospital
  | "WELCOME_HOSPITAL"
  | "HOSPITAL_REGISTRATION_SUBMITTED"
  | "HOSPITAL_VERIFICATION_APPROVED"
  | "HOSPITAL_VERIFICATION_REJECTED"

  // Doctor
  | "WELCOME_DOCTOR"
  | "DOCTOR_VERIFICATION_APPROVED"
  | "DOCTOR_VERIFICATION_REJECTED"

  // App flows
  | "APPOINTMENT_CONFIRMED"
  | "PAYMENT_SUCCESS"

  // Fallback / misc
  | "GENERAL";

/**
 * Generic notification payload
 * Used by notification.service.ts
 */
export interface NotificationPayload {
  phone?: string;
  email?: string;

  /**
   * Optional forced channel.
   * If not provided, system auto-selects (WhatsApp → SMS → Email)
   */
  channel?: NotificationChannel;

  /**
   * Business intent
   */
  purpose: NotificationPurpose;

  /**
   * Dynamic variables injected into templates
   * Example:
   * { otp: "123456", expiry: "5" }
   */
  variables: Record<string, string>;
}
