import { NotificationPurpose, type NotificationTemplateRegistry } from "./notification.types.js";

// =============================================================================
// Approved Interakt WhatsApp Template Names
//   Create these in Interakt dashboard FIRST. Templates are utility category, English.
// =============================================================================

const WA = {
  // Auth & security
  OTP: "rozx_otp_verification",            // {{1}}=otp {{2}}=expiry_minutes
  WELCOME: "rozx_account_welcome",          // {{1}}=name
  LOGIN_ALERT: "rozx_login_alert",          // {{1}}=device {{2}}=time {{3}}=ip

  // Appointments
  APPOINTMENT_CONFIRMED: "rozx_appointment_confirmation",   // {{1}}=patient {{2}}=doctor {{3}}=date {{4}}=type
  APPOINTMENT_REMINDER: "rozx_appointment_reminder",        // {{1}}=patient {{2}}=doctor {{3}}=datetime
  APPOINTMENT_CANCELLED: "rozx_appointment_cancellation",   // {{1}}=patient {{2}}=doctor {{3}}=date
  APPOINTMENT_RESCHEDULED: "rozx_appointment_rescheduled",  // {{1}}=patient {{2}}=doctor {{3}}=new_date {{4}}=new_time

  // Payments
  PAYMENT_CONFIRMED: "rozx_payment_confirmation",          // {{1}}=patient {{2}}=amount {{3}}=date

  // Consultation
  CONSULTATION_LINK: "rozx_consultation_link",             // {{1}}=patient {{2}}=doctor {{3}}=link

  // Prescriptions & medicine
  PRESCRIPTION_READY: "rozx_prescription_ready",           // {{1}}=patient {{2}}=doctor {{3}}=link
  MEDICINE_ORDER: "rozx_medicine_order_confirmation",       // {{1}}=patient {{2}}=order_id {{3}}=amount
} as const;

// =============================================================================
// Email Design System \u2014 Reusable Components
//
// All emails share a consistent branded layout: green header bar, white card
// body, and a subtle footer with copyright. Helper functions below produce
// HTML fragments that are composed into each template.
// =============================================================================

const C = {
  brand: '#059669',
  brandLight: '#ecfdf5',
  bg: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textSec: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  infoBg: '#f8fafc',
  warn: '#dc2626',
} as const;

/** Branded email shell: green header, white card body, copyright footer */
function shell(subtitle: string, content: string): string {
  return [
    `<div style="margin:0;padding:40px 16px;background-color:${C.bg};font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">`,
    `<div style="max-width:520px;margin:0 auto;background:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border}">`,
    `<div style="background-color:${C.brand};padding:24px 32px;text-align:center">`,
    '<h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px">ROZX Healthcare</h1>',
    subtitle ? `<p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">${subtitle}</p>` : '',
    '</div>',
    `<div style="padding:32px 28px">`,
    content,
    '</div>',
    `<div style="background-color:#f9fafb;padding:20px 28px;border-top:1px solid ${C.border};text-align:center">`,
    `<p style="font-size:11px;color:${C.faint};margin:0">\u00a9 2026 Rozx Healthcare Pvt. Ltd.</p>`,
    `<p style="font-size:11px;color:${C.faint};margin:4px 0 0"><a href="mailto:support@rozx.in" style="color:${C.brand};text-decoration:none">support@rozx.in</a></p>`,
    '</div>',
    '</div>',
    '</div>',
  ].join('');
}

/** Green call-to-action button */
function cta(label: string, href: string): string {
  return [
    '<div style="text-align:center;margin:28px 0">',
    `<a href="${href}" style="display:inline-block;background-color:${C.brand};color:#ffffff;font-weight:600;font-size:14px;padding:12px 36px;border-radius:8px;text-decoration:none">${label}</a>`,
    '</div>',
  ].join('');
}

/** Large OTP code display box */
function otpCode(): string {
  return [
    '<div style="text-align:center;margin:24px 0">',
    `<div style="display:inline-block;background-color:${C.brandLight};border:2px solid ${C.brand};border-radius:12px;padding:18px 44px">`,
    `<span style="font-size:36px;font-weight:700;letter-spacing:10px;color:${C.brand};font-family:'Courier New',monospace">{{otp}}</span>`,
    '</div>',
    '</div>',
  ].join('');
}

/** Info/detail card with left green accent border */
function info(rows: string): string {
  return `<div style="background-color:${C.infoBg};border-radius:8px;padding:16px 20px;margin:20px 0;border-left:4px solid ${C.brand}">${rows}</div>`;
}

/** Single labeled row inside an info card */
function row(label: string, value: string): string {
  return `<p style="margin:0 0 6px;font-size:14px;color:${C.textSec}"><span style="color:${C.muted}">${label}:</span> <strong>${value}</strong></p>`;
}

/** Horizontal rule divider */
const hr = `<hr style="border:none;border-top:1px solid ${C.border};margin:24px 0"/>`;

/** Small muted centered note */
function note(text: string): string {
  return `<p style="font-size:12px;color:${C.faint};text-align:center;margin:16px 0 0">${text}</p>`;
}

/** Centered circle icon badge */
function badge(emoji: string, bg: string): string {
  return [
    '<div style="text-align:center;margin:0 0 20px">',
    `<div style="display:inline-block;background-color:${bg};border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;text-align:center">${emoji}</div>`,
    '</div>',
  ].join('');
}

/** Feature list item for welcome emails */
function feat(emoji: string, title: string, desc: string): string {
  return `<p style="font-size:14px;margin:0 0 12px;color:${C.textSec};line-height:1.5">${emoji}&ensp;<strong>${title}</strong> \u2014 ${desc}</p>`;
}

// =============================================================================
// Template Registry
//
// Every NotificationPurpose MUST have an entry.
// - whatsapp   Interakt template name (only if approved template exists)
// - sms        Text with {{variable}} placeholders
// - email      { subject, body } with {{variable}} placeholders
//
// WhatsApp body values are passed as a positional array via `whatsappValues`
// in the NotificationPayload. The order must match the template body params.
// =============================================================================

export const templates: NotificationTemplateRegistry = {

  // ─── Auth & Security ────────────────────────────────────────────────────────

  [NotificationPurpose.OTP_LOGIN]: {
    whatsapp: WA.OTP,
    sms: "Your ROZX login code is {{otp}}. Valid for {{expiry}} minutes. Do not share this code.",
    email: {
      subject: "Your ROZX Login Code \u2014 {{otp}}",
      body: shell('Login Verification', [
        `<p style="font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center;color:${C.textSec}">Use the code below to log in to your account:</p>`,
        otpCode(),
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">This code expires in <strong>{{expiry}} minutes</strong>. Do not share it with anyone.</p>`,
        hr,
        note('If you did not request this code, please ignore this email.'),
      ].join('')),
    },
  },

  [NotificationPurpose.OTP_REGISTRATION]: {
    whatsapp: WA.OTP,
    sms: "Welcome to ROZX! Your registration code is {{otp}}. Valid for {{expiry}} minutes.",
    email: {
      subject: "Welcome to ROZX \u2014 Verification Code {{otp}}",
      body: shell('Account Verification', [
        `<p style="font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center;color:${C.textSec}">Use the code below to verify your phone and complete registration:</p>`,
        otpCode(),
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">This code expires in <strong>{{expiry}} minutes</strong>. Do not share it with anyone.</p>`,
        hr,
        note('If you did not request this code, please ignore this email.'),
      ].join('')),
    },
  },

  [NotificationPurpose.LOGIN_ALERT]: {
    whatsapp: WA.LOGIN_ALERT,
    sms: "New login on your ROZX account from {{device}} at {{time}}. Not you? Contact support.",
    email: {
      subject: "New Login Detected \u2014 ROZX",
      body: shell('Security Alert', [
        badge('\ud83d\udd12', '#fef3c7'),
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;text-align:center;color:${C.textSec}">A new login was detected on your ROZX account.</p>`,
        info([
          row('Device', '{{device}}'),
          row('Time', '{{time}}'),
          row('IP Address', '{{ip}}'),
        ].join('')),
        hr,
        `<p style="font-size:13px;color:${C.warn};text-align:center;margin:0;font-weight:600">If this wasn\u2019t you, please reset your password immediately.</p>`,
      ].join('')),
    },
  },

  // ─── Onboarding ─────────────────────────────────────────────────────────────

  [NotificationPurpose.WELCOME_PATIENT]: {
    whatsapp: WA.WELCOME,
    sms: "Welcome to ROZX, {{name}}! Book appointments, consult doctors & order medicines \u2014 all in one place.",
    email: {
      subject: "Welcome to ROZX Healthcare! \ud83c\udf89",
      body: shell('', [
        `<p style="font-size:18px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Hi {{name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:${C.textSec}">Thank you for joining ROZX! Your healthcare journey starts here.</p>`,
        `<div style="background-color:${C.brandLight};border-radius:10px;padding:20px 24px;margin:0 0 4px">`,
        feat('\ud83d\udcc5', 'Book Appointments', 'with verified doctors'),
        feat('\ud83e\ude7a', 'Consult Online', 'via video consultations'),
        feat('\ud83d\udccb', 'Digital Records', 'access prescriptions & health records'),
        `<p style="font-size:14px;margin:0;color:${C.textSec};line-height:1.5">\ud83d\udc8a&ensp;<strong>Order Medicines</strong> \u2014 from trusted pharmacies</p>`,
        '</div>',
        cta('Go to Dashboard', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.WELCOME_HOSPITAL]: {
    whatsapp: WA.WELCOME,
    sms: "Welcome {{name}}! Your hospital is now live on ROZX.",
    email: {
      subject: "Welcome to ROZX \u2014 Hospital Onboarded! \ud83c\udfe5",
      body: shell('', [
        `<p style="font-size:18px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Hi {{name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:${C.textSec}">Your hospital has been successfully registered on ROZX. Here\u2019s what you can manage:</p>`,
        `<div style="background-color:${C.brandLight};border-radius:10px;padding:20px 24px;margin:0 0 4px">`,
        feat('\ud83d\udc68\u200d\u2695\ufe0f', 'Manage Doctors', 'add & manage doctors and staff'),
        feat('\ud83d\udcc5', 'Appointments', 'handle schedules & bookings'),
        feat('\ud83d\udccb', 'Prescriptions', 'digital prescriptions & records'),
        `<p style="font-size:14px;margin:0;color:${C.textSec};line-height:1.5">\ud83d\udcca&ensp;<strong>Analytics</strong> \u2014 performance insights & reports</p>`,
        '</div>',
        cta('Go to Dashboard', '{{app_url}}'),
        `<p style="font-size:14px;line-height:1.6;margin:0 0 4px;color:${C.textSec};text-align:center">Our team will verify your hospital within <strong>24\u201348 hours</strong>.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.WELCOME_DOCTOR]: {
    whatsapp: WA.WELCOME,
    sms: "Welcome Dr. {{name}}! You\u2019re now on ROZX. Start managing your appointments.",
    email: {
      subject: "Welcome to ROZX \u2014 Doctor Profile Active! \ud83e\ude7a",
      body: shell('', [
        `<p style="font-size:18px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Hi Dr. {{name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:${C.textSec}">Your doctor profile is now active on ROZX. Start managing your practice digitally:</p>`,
        `<div style="background-color:${C.brandLight};border-radius:10px;padding:20px 24px;margin:0 0 4px">`,
        feat('\ud83d\udcc5', 'Appointments', 'manage schedules & bookings'),
        feat('\ud83c\udfa5', 'Video Consultations', 'consult with patients online'),
        feat('\ud83d\udccb', 'Prescriptions', 'write digital prescriptions'),
        `<p style="font-size:14px;margin:0;color:${C.textSec};line-height:1.5">\ud83d\udcca&ensp;<strong>Track Earnings</strong> \u2014 patient analytics & income</p>`,
        '</div>',
        cta('Go to Dashboard', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Verification ───────────────────────────────────────────────────────────

  [NotificationPurpose.PATIENT_VERIFICATION_FAILED]: {
    sms: "Your ROZX verification could not be completed. Please review your details and try again.",
    email: {
      subject: "Verification Incomplete \u2014 ROZX",
      body: shell('Verification Status', [
        badge('\u274c', '#fef2f2'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Hi {{name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${C.textSec}">We couldn\u2019t verify your details. Please review and update your information to continue using ROZX.</p>`,
        cta('Update Details', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.HOSPITAL_REGISTRATION_SUBMITTED]: {
    sms: "Hospital registration received. Our team will verify it within {{timeline}}.",
    email: {
      subject: "Hospital Registration Received \u2014 ROZX",
      body: shell('Registration Received', [
        badge('\ud83d\udce8', '#eff6ff'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Hi {{name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">We\u2019ve received your hospital registration. Our team will review and verify it within <strong>{{timeline}}</strong>.</p>`,
        `<p style="font-size:14px;line-height:1.6;color:${C.textSec}">You\u2019ll receive a confirmation email once the verification is complete.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.HOSPITAL_VERIFICATION_APPROVED]: {
    sms: "Your hospital {{hospital_name}} is now verified on ROZX!",
    email: {
      subject: "Hospital Verified \u2014 ROZX \u2705",
      body: shell('Verification Approved', [
        badge('\u2705', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:${C.text};text-align:center"><strong>Congratulations!</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${C.textSec};text-align:center">Your hospital <strong>{{hospital_name}}</strong> has been successfully verified on ROZX. You can now start accepting appointments.</p>`,
        cta('Go to Dashboard', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.HOSPITAL_VERIFICATION_REJECTED]: {
    sms: "Hospital verification failed: {{reason}}. Please update and resubmit.",
    email: {
      subject: "Hospital Verification Update \u2014 ROZX",
      body: shell('Verification Update', [
        badge('\u274c', '#fef2f2'),
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your hospital verification was unsuccessful.</p>`,
        info(row('Reason', '{{reason}}')),
        `<p style="font-size:14px;line-height:1.6;color:${C.textSec}">Please update the required details and resubmit for verification.</p>`,
        cta('Update & Resubmit', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.DOCTOR_VERIFICATION_APPROVED]: {
    sms: "Your doctor profile has been verified and is now active on ROZX.",
    email: {
      subject: "Doctor Profile Verified \u2014 ROZX \u2705",
      body: shell('Profile Verified', [
        badge('\u2705', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:${C.text};text-align:center"><strong>Congratulations!</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${C.textSec};text-align:center">Your doctor profile has been verified and is now active on ROZX. Patients can now book appointments with you.</p>`,
        cta('Go to Dashboard', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.DOCTOR_VERIFICATION_REJECTED]: {
    sms: "Doctor verification failed: {{reason}}. Please resubmit valid documents.",
    email: {
      subject: "Doctor Verification Update \u2014 ROZX",
      body: shell('Verification Update', [
        badge('\u274c', '#fef2f2'),
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your doctor verification was unsuccessful.</p>`,
        info(row('Reason', '{{reason}}')),
        `<p style="font-size:14px;line-height:1.6;color:${C.textSec}">Please resubmit valid documents to proceed with verification.</p>`,
        cta('Update Documents', '{{app_url}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Appointments ───────────────────────────────────────────────────────────

  [NotificationPurpose.APPOINTMENT_CONFIRMED]: {
    whatsapp: WA.APPOINTMENT_CONFIRMED,
    sms: "Appointment confirmed with Dr. {{doctor_name}} on {{date}} ({{type}}). \u2014 ROZX",
    email: {
      subject: "Appointment Confirmed \u2014 ROZX",
      body: shell('Appointment Confirmed', [
        badge('\u2705', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your appointment has been confirmed.</p>`,
        info([
          row('Doctor', 'Dr. {{doctor_name}}'),
          row('Date', '{{date}}'),
          row('Type', '{{type}}'),
        ].join('')),
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:16px 0 0">Please arrive 10 minutes early for in-clinic visits.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.APPOINTMENT_REMINDER]: {
    whatsapp: WA.APPOINTMENT_REMINDER,
    sms: "Reminder: Appointment with Dr. {{doctor_name}} on {{date}} at {{time}}. \u2014 ROZX",
    email: {
      subject: "Appointment Reminder \u2014 ROZX",
      body: shell('Upcoming Appointment', [
        badge('\u23f0', '#eff6ff'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">This is a friendly reminder for your upcoming appointment.</p>`,
        info([
          row('Doctor', 'Dr. {{doctor_name}}'),
          row('Date', '{{date}}'),
          row('Time', '{{time}}'),
        ].join('')),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.APPOINTMENT_CANCELLED]: {
    whatsapp: WA.APPOINTMENT_CANCELLED,
    sms: "Your appointment with Dr. {{doctor_name}} on {{date}} has been cancelled. \u2014 ROZX",
    email: {
      subject: "Appointment Cancelled \u2014 ROZX",
      body: shell('Appointment Cancelled', [
        badge('\u274c', '#fef2f2'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your appointment with Dr. {{doctor_name}} on {{date}} has been cancelled.</p>`,
        `<p style="font-size:14px;line-height:1.6;color:${C.textSec}">Refund (if applicable) will be processed within 5\u20137 business days.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.APPOINTMENT_RESCHEDULED]: {
    whatsapp: WA.APPOINTMENT_RESCHEDULED,
    sms: "Appointment rescheduled to {{new_date}} at {{new_time}} with Dr. {{doctor_name}}. \u2014 ROZX",
    email: {
      subject: "Appointment Rescheduled \u2014 ROZX",
      body: shell('Appointment Rescheduled', [
        badge('\ud83d\udcc5', '#eff6ff'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your appointment with Dr. {{doctor_name}} has been rescheduled.</p>`,
        info([
          row('New Date', '{{new_date}}'),
          row('New Time', '{{new_time}}'),
        ].join('')),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Payments ───────────────────────────────────────────────────────────────

  [NotificationPurpose.PAYMENT_SUCCESS]: {
    whatsapp: WA.PAYMENT_CONFIRMED,
    sms: "Payment of \u20b9{{amount}} received successfully. \u2014 ROZX",
    email: {
      subject: "Payment Confirmed \u2014 ROZX",
      body: shell('Payment Confirmed', [
        badge('\u2705', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">We\u2019ve received your payment successfully.</p>`,
        info([
          row('Amount', '\u20b9{{amount}}'),
          row('Date', '{{date}}'),
        ].join('')),
        `<p style="font-size:14px;line-height:1.6;color:${C.textSec};text-align:center;margin:16px 0 0">Thank you for choosing ROZX.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Consultations ──────────────────────────────────────────────────────────

  [NotificationPurpose.CONSULTATION_STARTED]: {
    whatsapp: WA.CONSULTATION_LINK,
    sms: "Your consultation with Dr. {{doctor_name}} has started. Join here: {{link}}",
    email: {
      subject: "Consultation Started \u2014 Join Now",
      body: shell('Consultation Started', [
        badge('\ud83c\udfa5', '#eff6ff'),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Dr. {{doctor_name}} has started the consultation. Please join now.</p>`,
        cta('Join Consultation', '{{link}}'),
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.CONSULTATION_LINK]: {
    whatsapp: WA.CONSULTATION_LINK,
    sms: "Your consultation link with Dr. {{doctor_name}}: {{link}} \u2014 ROZX",
    email: {
      subject: "Consultation Link \u2014 ROZX",
      body: shell('Video Consultation', [
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Here is the link for your video consultation with Dr. {{doctor_name}}.</p>`,
        cta('Join Consultation', '{{link}}'),
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">Please join 5 minutes before the scheduled time.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Prescriptions & Medicine ───────────────────────────────────────────────

  [NotificationPurpose.PRESCRIPTION_READY]: {
    whatsapp: WA.PRESCRIPTION_READY,
    sms: "Prescription from Dr. {{doctor_name}} is ready. View: {{link}} \u2014 ROZX",
    email: {
      subject: "Prescription Ready \u2014 ROZX",
      body: shell('Prescription Ready', [
        badge('\ud83d\udccb', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your digital prescription from Dr. {{doctor_name}} is ready.</p>`,
        cta('View Prescription', '{{link}}'),
        `<p style="font-size:14px;color:${C.muted};text-align:center;margin:0">Get well soon! \ud83d\ude4f</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  [NotificationPurpose.MEDICINE_ORDER_CONFIRMATION]: {
    whatsapp: WA.MEDICINE_ORDER,
    sms: "Medicine order #{{order_id}} confirmed. Amount: \u20b9{{amount}}. \u2014 ROZX",
    email: {
      subject: "Medicine Order Confirmed \u2014 ROZX",
      body: shell('Order Confirmed', [
        badge('\ud83d\udc8a', C.brandLight),
        `<p style="font-size:16px;line-height:1.6;margin:0 0 4px;color:${C.text}"><strong>Dear {{patient_name}},</strong></p>`,
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:${C.textSec}">Your medicine order has been placed successfully.</p>`,
        info([
          row('Order ID', '#{{order_id}}'),
          row('Total', '\u20b9{{amount}}'),
        ].join('')),
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:16px 0 0">Track your order in the app.</p>`,
        hr,
        `<p style="font-size:13px;color:${C.muted};text-align:center;margin:0">\u2014 Team ROZX</p>`,
      ].join('')),
    },
  },

  // ─── Generic ────────────────────────────────────────────────────────────────

  [NotificationPurpose.GENERAL]: {
    sms: "{{message}}",
    email: {
      subject: "{{subject}}",
      body: "{{message}}",
    },
  },
};
