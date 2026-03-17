/**
 * Notification Integration Types
 *
 * Channel priority: WhatsApp → SMS → Email
 * WhatsApp is the PRIMARY channel via Interakt API.
 *
 * Approved WhatsApp templates (Interakt):
 *   rozx_otp_verification, rozx_account_welcome, rozx_login_alert,
 *   rozx_appointment_confirmation, rozx_appointment_reminder,
 *   rozx_appointment_cancellation, rozx_appointment_rescheduled,
 *   rozx_payment_confirmation, rozx_consultation_link,
 *   rozx_prescription_ready, rozx_medicine_order_confirmation
 */

// ── Channel ─────────────────────────────────────────────────────────────────
export enum NotificationChannel {
  Email = "email",
  SMS = "sms",
  WhatsApp = "whatsapp",
}

// ── Purpose ─────────────────────────────────────────────────────────────────
// Every transactional notification has a purpose mapping to a template set.
export enum NotificationPurpose {
  // Auth & security
  OTP_LOGIN = "otp_login",
  OTP_REGISTRATION = "otp_registration",
  LOGIN_ALERT = "login_alert",

  // Onboarding
  WELCOME_PATIENT = "welcome_patient",
  WELCOME_HOSPITAL = "welcome_hospital",
  WELCOME_DOCTOR = "welcome_doctor",

  // Verification
  PATIENT_VERIFICATION_FAILED = "patient_verification_failed",
  HOSPITAL_REGISTRATION_SUBMITTED = "hospital_registration_submitted",
  HOSPITAL_VERIFICATION_APPROVED = "hospital_verification_approved",
  HOSPITAL_VERIFICATION_REJECTED = "hospital_verification_rejected",
  DOCTOR_VERIFICATION_APPROVED = "doctor_verification_approved",
  DOCTOR_VERIFICATION_REJECTED = "doctor_verification_rejected",

  // Appointments
  APPOINTMENT_CONFIRMED = "appointment_confirmed",
  APPOINTMENT_REMINDER = "appointment_reminder",
  APPOINTMENT_CANCELLED = "appointment_cancelled",
  APPOINTMENT_RESCHEDULED = "appointment_rescheduled",

  // Payments
  PAYMENT_SUCCESS = "payment_success",

  // Consultations
  CONSULTATION_STARTED = "consultation_started",
  CONSULTATION_LINK = "consultation_link",

  // Prescriptions & medicine
  PRESCRIPTION_READY = "prescription_ready",
  MEDICINE_ORDER_CONFIRMATION = "medicine_order_confirmation",

  // Generic
  GENERAL = "general",
}

// ── Template shape ──────────────────────────────────────────────────────────
export interface NotificationTemplate {
  /** Interakt WhatsApp template name (must be approved in dashboard) */
  whatsapp?: string;
  /** SMS text with {{variable}} placeholders */
  sms?: string;
  /** Email subject + body with {{variable}} placeholders */
  email?: { subject: string; body: string };
}

export type NotificationTemplateRegistry = Record<NotificationPurpose, NotificationTemplate>;

// ── Payload ─────────────────────────────────────────────────────────────────
export interface NotificationPayload {
  /** Business intent — maps to a template set */
  purpose: NotificationPurpose;
  /** Force a specific channel (skip fallback chain) */
  channel?: NotificationChannel;
  /** Recipient phone number (required for WhatsApp & SMS) */
  phone?: string;
  /** Recipient email (required for Email) */
  email?: string;
  /** Named variables for SMS/Email interpolation: {{key}} → value */
  variables: Record<string, string>;
  /**
   * Positional variable values for Interakt WhatsApp templates.
   * Order MUST match the template body placeholders ({{1}}, {{2}}, …).
   * If omitted, Object.values(variables) is used as fallback.
   */
  whatsappValues?: string[];
}
