import type { NotificationPurpose } from "./types.js";
import { env } from "../../config/env.js";

// Sensible defaults if env is not configured. Update these to your approved names.
const DEFAULT_OTP_LOGIN_TMPL = env.WHATSAPP_TEMPLATE_OTP_LOGIN || "rozx_otp_login";
const DEFAULT_OTP_REG_TMPL = env.WHATSAPP_TEMPLATE_OTP_REGISTRATION || DEFAULT_OTP_LOGIN_TMPL;

/**
 * Shape of a single notification template
 * All channels are optional by design
 */
export type NotificationTemplate = {
  whatsapp?: string; // Meta approved template name
  sms?: string;      // Plain text SMS
  email?: {
    subject: string;
    body: string;
  };
};

/**
 * Central template registry
 * Every NotificationPurpose must exist here
 */
export const templates: Record<NotificationPurpose, NotificationTemplate> = {
  // =================================================
  // OTP
  // =================================================

  OTP_LOGIN: {
    whatsapp: DEFAULT_OTP_LOGIN_TMPL,
    sms: "Your ROZX login code is {{otp}}. Valid for {{expiry}} minutes.",
    email: {
      subject: "Your ROZX Login Code",
      body: "Your verification code is {{otp}}. It expires in {{expiry}} minutes.",
    },
  },

  OTP_REGISTRATION: {
    // Use dedicated template if configured, else reuse the login template
    whatsapp: DEFAULT_OTP_REG_TMPL,
    sms: "Welcome to ROZX! Your registration code is {{otp}}. Valid for {{expiry}} minutes.",
    email: {
      subject: "Welcome to ROZX – Registration Code",
      body: "Your registration code is {{otp}}. It expires in {{expiry}} minutes.",
    },
  },

  // =================================================
  // Patient
  // =================================================

  WELCOME_PATIENT: {
    whatsapp: "rozx_welcome_patient",
    sms: "Welcome to ROZX, {{name}}! You can now book appointments easily.",
    email: {
      subject: "Welcome to ROZX 🎉",
      body: "Hi {{name}}, welcome to ROZX. Your healthcare journey starts here.",
    },
  },

  PATIENT_VERIFICATION_FAILED: {
    whatsapp: "rozx_patient_verification_failed",
    sms: "We couldn’t verify your details. Please review and try again.",
    email: {
      subject: "Verification Issue",
      body: "Hi {{name}}, we couldn’t verify your details. Please update and resubmit.",
    },
  },

  // =================================================
  // Hospital
  // =================================================

  HOSPITAL_REGISTRATION_SUBMITTED: {
    whatsapp: "rozx_hospital_registration_submitted",
    sms: "We’ve received your hospital registration. Our team will verify it within {{timeline}}.",
    email: {
      subject: "Hospital Registration Received",
      body: "Hi {{name}}, we’ve received your hospital registration. Our team will verify it within {{timeline}}.",
    },
  },

  HOSPITAL_VERIFICATION_APPROVED: {
    whatsapp: "rozx_hospital_verified",
    sms: "🎉 Your hospital {{hospitalName}} is now verified on ROZX.",
    email: {
      subject: "Hospital Verified 🎉",
      body: "Congratulations! Your hospital {{hospitalName}} has been successfully verified on ROZX.",
    },
  },

  HOSPITAL_VERIFICATION_REJECTED: {
    whatsapp: "rozx_hospital_verification_rejected",
    sms: "Your hospital verification failed due to {{reason}}. Please update the details.",
    email: {
      subject: "Hospital Verification Update",
      body: "Your hospital verification failed due to {{reason}}. Please update and resubmit.",
    },
  },

  WELCOME_HOSPITAL: {
    whatsapp: "rozx_welcome_hospital",
    sms: "Welcome {{name}}! Your hospital is now live on ROZX.",
    email: {
      subject: "Welcome to ROZX Hospitals",
      body: "Hi {{name}}, your hospital has been successfully onboarded on ROZX.",
    },
  },

  // =================================================
  // Doctor
  // =================================================

  WELCOME_DOCTOR: {
    whatsapp: "rozx_welcome_doctor",
    sms: "Welcome Dr. {{name}}! You’re now associated with {{hospitalName}} on ROZX.",
    email: {
      subject: "Welcome to ROZX",
      body: "Hi Dr. {{name}}, you’re now associated with {{hospitalName}} on ROZX.",
    },
  },

  DOCTOR_VERIFICATION_APPROVED: {
    whatsapp: "rozx_doctor_verified",
    sms: "Your doctor profile has been verified and is now active on ROZX.",
    email: {
      subject: "Doctor Profile Verified",
      body: "Your doctor profile has been verified and is now active on ROZX.",
    },
  },

  DOCTOR_VERIFICATION_REJECTED: {
    whatsapp: "rozx_doctor_verification_rejected",
    sms: "Your doctor verification failed due to {{reason}}. Please resubmit valid documents.",
    email: {
      subject: "Doctor Verification Update",
      body: "Your verification failed due to {{reason}}. Please resubmit valid documents.",
    },
  },

  // =================================================
  // App flows
  // =================================================

  APPOINTMENT_CONFIRMED: {
    whatsapp: "rozx_appointment_confirmed",
    sms: "Your appointment with {{doctor}} is confirmed for {{time}}.",
    email: {
      subject: "Appointment Confirmed",
      body: "Your appointment with {{doctor}} is confirmed for {{time}}.",
    },
  },

  PAYMENT_SUCCESS: {
    whatsapp: "rozx_payment_success",
    sms: "Payment of ₹{{amount}} successful. Txn ID: {{txnId}}.",
    email: {
      subject: "Payment Successful",
      body: "We received your payment of ₹{{amount}}. Transaction ID: {{txnId}}.",
    },
  },

  // =================================================
  // Generic fallback
  // =================================================

  GENERAL: {
    sms: "{{message}}",
    email: {
      subject: "Notification from ROZX",
      body: "{{message}}",
    },
  },
};
