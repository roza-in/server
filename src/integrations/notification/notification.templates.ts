import { env } from "../../config/env.js";
import { NotificationPurpose, NotificationTemplateRegistry } from "./notification.types.js";

/**
 * WhatsApp template names (Interakt)
 * Templates must be approved in Interakt dashboard before use
 */
const WHATSAPP_TEMPLATES = {
  // OTP (approved for Interakt)
  ROZX_AUTH_OTP: "rozx_auth_otp",
  OTP_LOGIN: env.WHATSAPP_TEMPLATE_OTP_LOGIN || "rozx_auth_otp",
  OTP_REGISTRATION: env.WHATSAPP_TEMPLATE_OTP_REGISTRATION || "rozx_auth_otp",

  // Appointment lifecycle
  APPOINTMENT_CONFIRMED: "rozx_appointment_confirmation",
  APPOINTMENT_REMINDER: "rozx_appointment_reminder",
  APPOINTMENT_CANCELLED: "rozx_appointment_cancellation",
  APPOINTMENT_RESCHEDULED: "rozx_appointment_rescheduled",

  // Consultation
  CONSULTATION_LINK: "rozx_consultation_link",
  PRESCRIPTION_READY: "rozx_prescription_ready",

  // Payments
  PAYMENT_SUCCESS: "rozx_payment_confirmation",

  // Medicine
  MEDICINE_ORDER_CONFIRMATION: "rozx_medicine_order_confirmation",

  // Security
  LOGIN_ALERT: "rozx_login_alert",
};

/**
 * Central Notification Template Registry
 * ⚠️ Every NotificationPurpose MUST exist here
 */
export const templates: NotificationTemplateRegistry = {
  // =================================================
  // OTP
  // =================================================

  [NotificationPurpose.OTP_LOGIN]: {
    whatsapp: WHATSAPP_TEMPLATES.OTP_LOGIN,
    sms: "Your ROZX login code is {{otp}}. Valid for {{expiry}} minutes.",
    email: {
      subject: "Your ROZX Login Code",
      body: "Your verification code is {{otp}}. It expires in {{expiry}} minutes.",
    },
  },

  [NotificationPurpose.OTP_REGISTRATION]: {
    whatsapp: WHATSAPP_TEMPLATES.OTP_REGISTRATION,
    sms: "Welcome to ROZX! Your registration code is {{otp}}. Valid for {{expiry}} minutes.",
    email: {
      subject: "Welcome to ROZX – Registration Code",
      body: "Your registration code is {{otp}}. It expires in {{expiry}} minutes.",
    },
  },

  // =================================================
  // Security
  // =================================================

  [NotificationPurpose.LOGIN_ALERT]: {
    whatsapp: WHATSAPP_TEMPLATES.LOGIN_ALERT,
    sms: "New login to your ROZX account from {{device}}. If not you, contact support immediately.",
    email: {
      subject: "New Login Detected - ROZX",
      body: "Start: New login detected on your ROZX account.\n\nDevice: {{device}}\nTime: {{time}}\nIP: {{ip}}\n\nIf this wasn't you, please reset your password immediately.",
    },
  },

  // =================================================
  // Patient
  // =================================================

  [NotificationPurpose.WELCOME_PATIENT]: {
    // WhatsApp template not yet created in Interakt - uses SMS/Email fallback
    sms: "Welcome to ROZX, {{name}}! You can now book appointments easily.",
    email: {
      subject: "Welcome to ROZX 🎉",
      body: "Hi {{name}}, welcome to ROZX. Your healthcare journey starts here.",
    },
  },

  [NotificationPurpose.PATIENT_VERIFICATION_FAILED]: {
    // WhatsApp template not created - uses SMS/Email fallback
    sms: "We couldn’t verify your details. Please review and try again.",
    email: {
      subject: "Verification Issue",
      body: "Hi {{name}}, we couldn’t verify your details. Please update and try again.",
    },
  },

  // =================================================
  // Hospital
  // =================================================

  [NotificationPurpose.HOSPITAL_REGISTRATION_SUBMITTED]: {
    // WhatsApp template not created - uses SMS/Email fallback
    sms: "We’ve received your hospital registration. Our team will verify it within {{timeline}}.",
    email: {
      subject: "Hospital Registration Received",
      body: "Hi {{name}}, we’ve received your hospital registration. Our team will verify it within {{timeline}}.",
    },
  },

  [NotificationPurpose.HOSPITAL_VERIFICATION_APPROVED]: {
    sms: "🎉 Your hospital {{hospitalName}} is now verified on ROZX.",
    email: {
      subject: "Hospital Verified 🎉",
      body: "Congratulations! Your hospital {{hospitalName}} has been successfully verified on ROZX.",
    },
  },

  [NotificationPurpose.HOSPITAL_VERIFICATION_REJECTED]: {
    sms: "Your hospital verification failed due to {{reason}}. Please update the details.",
    email: {
      subject: "Hospital Verification Update",
      body: "Your hospital verification failed due to {{reason}}. Please update and resubmit.",
    },
  },

  [NotificationPurpose.WELCOME_HOSPITAL]: {
    sms: "Welcome {{name}}! Your hospital is now live on ROZX.",
    email: {
      subject: "Welcome to ROZX Hospitals",
      body: "Hi {{name}}, your hospital has been successfully onboarded on ROZX.",
    },
  },

  // =================================================
  // Doctor
  // =================================================

  [NotificationPurpose.WELCOME_DOCTOR]: {
    // WhatsApp template not created - uses SMS/Email fallback
    sms: "Welcome Dr. {{name}}! You’re now associated with {{hospitalName}} on ROZX.",
    email: {
      subject: "Welcome to ROZX",
      body: "Hi Dr. {{name}}, you’re now associated with {{hospitalName}} on ROZX.",
    },
  },

  [NotificationPurpose.DOCTOR_VERIFICATION_APPROVED]: {
    sms: "Your doctor profile has been verified and is now active on ROZX.",
    email: {
      subject: "Doctor Profile Verified",
      body: "Your doctor profile has been verified and is now active on ROZX.",
    },
  },

  [NotificationPurpose.DOCTOR_VERIFICATION_REJECTED]: {
    sms: "Your doctor verification failed due to {{reason}}. Please resubmit valid documents.",
    email: {
      subject: "Doctor Verification Update",
      body: "Your verification failed due to {{reason}}. Please resubmit valid documents.",
    },
  },

  // =================================================
  // App Flows
  // =================================================

  // =================================================
  // App Flows
  // =================================================

  [NotificationPurpose.APPOINTMENT_CONFIRMED]: {
    whatsapp: WHATSAPP_TEMPLATES.APPOINTMENT_CONFIRMED,
    sms: "Your appointment with {{doctor}} is confirmed for {{time}}.",
    email: {
      subject: "Appointment Confirmed - ROZX",
      body: "Dear {{patient_name}},\n\nYour appointment has been successfully confirmed.\n\nDoctor: Dr. {{doctor_name}}\nDate: {{date}}\nTime: {{time}}\n\nPlease arrive 10 minutes before your scheduled time.\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.APPOINTMENT_REMINDER]: {
    whatsapp: WHATSAPP_TEMPLATES.APPOINTMENT_REMINDER,
    sms: "Reminder: You have an appointment with {{doctor_name}} tomorrow at {{time}}.",
    email: {
      subject: "Appointment Reminder - ROZX",
      body: "Dear {{patient_name}},\n\nThis is a gentle reminder for your upcoming appointment.\n\nDoctor: Dr. {{doctor_name}}\nDate: {{date}}\nTime: {{time}}\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.APPOINTMENT_CANCELLED]: {
    whatsapp: WHATSAPP_TEMPLATES.APPOINTMENT_CANCELLED,
    sms: "Your appointment with Dr. {{doctor_name}} on {{date}} has been cancelled.",
    email: {
      subject: "Appointment Cancelled - ROZX",
      body: "Dear {{patient_name}},\n\nYour appointment with Dr. {{doctor_name}} scheduled for {{date}} at {{time}} has been cancelled.\n\nRefund (if applicable) will be processed within 5-7 business days.\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.APPOINTMENT_RESCHEDULED]: {
    whatsapp: WHATSAPP_TEMPLATES.APPOINTMENT_RESCHEDULED,
    sms: "Your appointment with Dr. {{doctor_name}} is rescheduled to {{new_date}} at {{new_time}}.",
    email: {
      subject: "Appointment Rescheduled - ROZX",
      body: "Dear {{patient_name}},\n\nYour appointment with Dr. {{doctor_name}} has been rescheduled.\n\nNew Date: {{new_date}}\nNew Time: {{new_time}}\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.PAYMENT_SUCCESS]: {
    whatsapp: WHATSAPP_TEMPLATES.PAYMENT_SUCCESS,
    sms: "Payment of ₹{{amount}} successful. Txn ID: {{txnId}}.",
    email: {
      subject: "Payment Receipt - ROZX",
      body: "Dear User,\n\nWe received your payment of ₹{{amount}}.\nTransaction ID: {{txnId}}\nDate: {{date}}\n\nThank you for choosing ROZX.",
    },
  },

  [NotificationPurpose.CONSULTATION_STARTED]: {
    sms: "Your consultation with Dr. {{doctor_name}} has started. Join here: {{link}}",
    email: {
      subject: "Consultation Started - Join Now",
      body: "Dear {{patient_name}},\n\nDr. {{doctor_name}} has started the video consultation.\n\nPlease join immediately using this link:\n{{link}}\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.CONSULTATION_LINK]: {
    whatsapp: WHATSAPP_TEMPLATES.CONSULTATION_LINK,
    sms: "Join your consultation with Dr. {{doctor_name}} here: {{link}}",
    email: {
      subject: "Video Consultation Link - ROZX",
      body: "Dear {{patient_name}},\n\nHere is the link for your upcoming video consultation with Dr. {{doctor_name}}.\n\nLink: {{link}}\n\nPlease join 5 minutes before the scheduled time.\n\nRegards,\nTeam ROZX",
    },
  },

  [NotificationPurpose.PRESCRIPTION_READY]: {
    whatsapp: WHATSAPP_TEMPLATES.PRESCRIPTION_READY,
    sms: "Your prescription from Dr. {{doctor_name}} is ready. View it here: {{link}}",
    email: {
      subject: "Prescription Ready - ROZX",
      body: "Dear {{patient_name}},\n\nYour digital prescription from Dr. {{doctor_name}} is ready.\n\nYou can view and download it here:\n{{link}}\n\nGet well soon!\nTeam ROZX",
    },
  },

  [NotificationPurpose.MEDICINE_ORDER_CONFIRMATION]: {
    whatsapp: WHATSAPP_TEMPLATES.MEDICINE_ORDER_CONFIRMATION,
    sms: "Your medicine order #{{order_id}} is confirmed. Amount: ₹{{amount}}.",
    email: {
      subject: "Medicine Order Confirmed - ROZX",
      body: "Dear {{customer_name}},\n\nYour medicine order #{{order_id}} has been successfully placed.\n\nTotal Amount: ₹{{amount}}\nestimated Delivery: {{delivery_date}}\n\nYou can track your order in the app.\n\nRegards,\nTeam ROZX",
    },
  },

  // =================================================
  // Generic
  // =================================================

  [NotificationPurpose.GENERAL]: {
    sms: "{{message}}",
    email: {
      subject: "Notification from ROZX",
      body: "{{message}}",
    },
  },
};
