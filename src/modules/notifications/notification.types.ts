import type { NotificationType, NotificationChannel } from '../../types/database.types.js';

/**
 * Notification Module Types - Extended from database schema
 */

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, any> | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationWithUser extends Notification {
  user?: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
  };
}

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  status: string;
  read_at: string | null;
  created_at: string;
}

// ============================================================================
// Preferences Types
// ============================================================================

export interface NotificationPreferences {
  id: string;
  user_id: string;
  // Channel preferences
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  // Type preferences
  appointment_notifications: boolean;
  payment_notifications: boolean;
  reminder_notifications: boolean;
  promotional_notifications: boolean;
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  // Frequency
  digest_mode: boolean;
  digest_frequency: 'daily' | 'weekly' | null;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesInput {
  whatsapp_enabled?: boolean;
  sms_enabled?: boolean;
  email_enabled?: boolean;
  push_enabled?: boolean;
  in_app_enabled?: boolean;
  appointment_notifications?: boolean;
  payment_notifications?: boolean;
  reminder_notifications?: boolean;
  promotional_notifications?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  digest_mode?: boolean;
  digest_frequency?: 'daily' | 'weekly';
}

// ============================================================================
// Device Token Types
// ============================================================================

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_info: Record<string, any> | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface RegisterDeviceInput {
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_info?: {
    model?: string;
    os_version?: string;
    app_version?: string;
  };
}

// ============================================================================
// Message Types
// ============================================================================

export interface WhatsAppMessage {
  to: string;
  template: string;
  language?: string;
  components?: WhatsAppComponent[];
}

export interface WhatsAppComponent {
  type: 'header' | 'body' | 'button';
  parameters: WhatsAppParameter[];
}

export interface WhatsAppParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename: string };
}

export interface SMSMessage {
  to: string;
  message: string;
  sender_id?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  reply_to?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string;
  encoding?: 'base64';
  type?: string;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  image?: string;
  badge?: number;
  sound?: string;
  click_action?: string;
}

// ============================================================================
// Template Types
// ============================================================================

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  whatsapp_template?: string;
  sms_template?: string;
  email_subject?: string;
  email_html?: string;
  push_title?: string;
  push_body?: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariables {
  // Patient variables
  patient_name?: string;
  patient_phone?: string;
  // Doctor variables
  doctor_name?: string;
  doctor_title?: string;
  specialization?: string;
  // Hospital variables
  hospital_name?: string;
  hospital_address?: string;
  hospital_phone?: string;
  // Appointment variables
  booking_id?: string;
  appointment_date?: string;
  appointment_time?: string;
  consultation_type?: string;
  // Payment variables
  amount?: string;
  transaction_id?: string;
  payment_method?: string;
  // Generic
  message?: string;
  title?: string;
  link?: string;
  otp?: string;
}

// ============================================================================
// WhatsApp Template Names
// ============================================================================

export const WHATSAPP_TEMPLATES = {
  // Authentication
  OTP_VERIFICATION: 'otp_verification',
  WELCOME_MESSAGE: 'welcome_message',
  
  // Appointments
  APPOINTMENT_BOOKED: 'appointment_booked',
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_REMINDER_24H: 'appointment_reminder_24h',
  APPOINTMENT_REMINDER_1H: 'appointment_reminder_1h',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  APPOINTMENT_RESCHEDULED: 'appointment_rescheduled',
  
  // Consultations
  CONSULTATION_STARTING: 'consultation_starting',
  CONSULTATION_COMPLETED: 'consultation_completed',
  PRESCRIPTION_READY: 'prescription_ready',
  
  // Payments
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_INITIATED: 'refund_initiated',
  REFUND_COMPLETED: 'refund_completed',
  
  // Doctor/Hospital
  PROFILE_VERIFIED: 'profile_verified',
  VERIFICATION_REQUIRED: 'verification_required',
  NEW_APPOINTMENT_DOCTOR: 'new_appointment_doctor',
} as const;

// ============================================================================
// Request/Response Types
// ============================================================================

export interface SendNotificationInput {
  user_id: string;
  type: NotificationType;
  channels?: NotificationChannel[];
  variables: TemplateVariables;
  data?: Record<string, any>;
  schedule_at?: string;
}

export interface SendBulkNotificationInput {
  user_ids: string[];
  type: NotificationType;
  channels?: NotificationChannel[];
  variables: TemplateVariables;
  data?: Record<string, any>;
}

export interface NotificationFilters {
  user_id?: string;
  type?: NotificationType | NotificationType[];
  channel?: NotificationChannel;
  status?: string;
  is_read?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  notifications: NotificationListItem[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
}

// ============================================================================
// Stats Types
// ============================================================================

export interface NotificationStats {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  by_channel: Record<NotificationChannel, number>;
  by_type: Record<NotificationType, number>;
  delivery_rate: number;
  read_rate: number;
}

// ============================================================================
// Provider Response Types
// ============================================================================

export interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface SMSResponse {
  message_id: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
}

export interface EmailResponse {
  message_id: string;
  status: 'accepted' | 'rejected';
}

export interface PushResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}
