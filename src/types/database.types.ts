/**
 * Supabase Database Types
 * Auto-generated from database schema
 * Re-export from generated types and provide Supabase-compatible Database interface
 */

import { definitions } from './database.generated.js';

// Re-export all table row types from definitions
export type User = definitions['users'];
export type Doctor = definitions['doctors'];
export type Hospital = definitions['hospitals'];
export type Appointment = definitions['appointments'];
export type Payment = definitions['payments'];
export type Prescription = definitions['prescriptions'];
export type Refund = definitions['refunds'];
export type Rating = definitions['ratings'];
export type Notification = definitions['notifications'];
export type NotificationTemplate = definitions['notification_templates'];
export type NotificationPreference = definitions['notification_preferences'];
export interface UserSession {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_id?: string | null;
  device_type?: string | null;
  device_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  is_active: boolean;
  expires_at: string;
  last_used_at: string;
  created_at: string;
}
export type OtpCode = definitions['otp_codes'];
export type PasswordResetToken = definitions['password_reset_tokens'];
export type LoginHistory = definitions['login_history'];
export type Specialization = definitions['specializations'];
export type DoctorSchedule = definitions['doctor_schedules'];
export type ScheduleOverride = definitions['schedule_overrides'];
export type AppointmentSlot = definitions['appointment_slots'];
export type AppointmentWaitlist = definitions['appointment_waitlist'];
export type AppointmentAttachment = definitions['appointment_attachments'];
export type FamilyMember = definitions['family_members'];
export type PatientCredit = definitions['patient_credits'];
export type CreditTransaction = definitions['credit_transactions'];
export type PatientVital = definitions['patient_vitals'];
export type HealthDocument = definitions['health_documents'];
export type MedicationReminder = definitions['medication_reminders'];
export type MedicationLog = definitions['medication_logs'];
export type HospitalSettlement = definitions['hospital_settlements'];
export type SettlementLineItem = definitions['settlement_line_items'];
export type Invoice = definitions['invoices'];
export type HospitalAnnouncement = definitions['hospital_announcements'];
export type SupportTicket = definitions['support_tickets'];
export type SupportTicketMessage = definitions['support_ticket_messages'];
export type Consultation = definitions['consultations'];
export type DeviceToken = definitions['device_tokens'];
export type RatingHelpfulness = definitions['rating_helpfulness'];
export type AuditLog = definitions['audit_logs'];
export type SystemSetting = definitions['system_settings'];
export type ApiKey = definitions['api_keys'];
export type ScheduledNotification = definitions['scheduled_notifications'];

// Enum types extracted from schema
export type UserRole = 'patient' | 'reception' | 'doctor' | 'hospital' | 'pharmacy' | 'admin';
export type Gender = 'male' | 'female' | 'other';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
export type AppointmentStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';
export type ConsultationType = 'in_person' | 'online' | 'walk_in';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'upi' | 'card' | 'net_banking' | 'wallet' | 'emi' | 'cash';
export type RefundType = 'full' | 'partial_75' | 'partial_50' | 'none' | 'doctor_cancelled' | 'technical_failure';
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
export type HospitalType = 'multi_specialty' | 'single_specialty' | 'nursing_home' | 'clinic' | 'diagnostic_center' | 'medical_college' | 'primary_health';
export type SubscriptionTier = 'free' | 'standard' | 'premium' | 'enterprise';
export type NotificationType =
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'appointment_check_in'
  | 'consultation_started'
  | 'consultation_ended'
  | 'waiting_room_ready'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_refund_initiated'
  | 'payment_refund_completed'
  | 'prescription_ready'
  | 'medicine_reminder'
  | 'refill_reminder'
  | 'follow_up_reminder'
  | 'lab_report_ready'
  | 'welcome'
  | 'profile_verified'
  | 'profile_rejected'
  | 'password_changed'
  | 'new_doctor_available'
  | 'hospital_announcement'
  | 'promotional'
  | 'health_tip'
  | 'general';
export type NotificationChannel = 'sms' | 'whatsapp' | 'email' | 'push' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type DocumentType = 'prescription' | 'lab_report' | 'imaging' | 'medical_certificate' | 'discharge_summary' | 'insurance_document' | 'vaccination_record' | 'other';
export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'appointment' | 'payment' | 'technical' | 'doctor' | 'hospital' | 'feedback' | 'other';

// Additional enum types
export type ConsultationStatus = 'scheduled' | 'waiting' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type OTPPurpose = 'registration' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification' | 'transaction';
export type OTPChannel = 'sms' | 'whatsapp' | 'email';
export type RelationshipType = 'self' | 'spouse' | 'parent' | 'child' | 'sibling' | 'other';

// Medicine E-Commerce Enums
export type MedicineCategory =
  | 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream'
  | 'ointment' | 'drops' | 'inhaler' | 'powder' | 'gel'
  | 'spray' | 'patch' | 'suppository' | 'solution' | 'suspension' | 'other';

export type MedicineSchedule =
  | 'otc' | 'schedule_h' | 'schedule_h1' | 'schedule_x'
  | 'ayurvedic' | 'homeopathic';

export type PharmacyType =
  | 'hospital_pharmacy' | 'retail_pharmacy' | 'chain_pharmacy' | 'online_pharmacy';

export type MedicineOrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'ready_for_pickup'
  | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'failed';

export type FulfillmentType =
  | 'platform_delivery' | 'pharmacy_pickup' | 'self_arrange' | 'hospital_pharmacy';

export type DeliveryPartnerStatus =
  | 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type HospitalStaffRole =
  | 'receptionist' | 'nurse' | 'admin' | 'billing';

// Medicine E-Commerce Type Definitions (simplified - full types will be auto-generated)
export interface Pharmacy {
  id: string;
  name: string;
  slug?: string;
  type: PharmacyType;
  hospital_id?: string;
  drug_license_number: string;
  gst_number?: string;
  phone: string;
  email?: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  location?: { lat: number; lng: number };
  working_hours?: Record<string, { open: string; close: string }>;
  is_24x7: boolean;
  home_delivery: boolean;
  min_order_amount: number;
  delivery_radius_km: number;
  platform_commission_percent: number;
  is_active: boolean;
  verification_status: VerificationStatus;
  rating: number;
  total_orders: number;
  owner_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  api_endpoint?: string;
  service_cities?: string[];
  base_delivery_fee: number;
  per_km_fee: number;
  max_delivery_distance_km: number;
  avg_pickup_time_minutes: number;
  avg_delivery_time_minutes: number;
  status: DeliveryPartnerStatus;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  generic_name?: string;
  brand?: string;
  manufacturer?: string;
  category: MedicineCategory;
  schedule: MedicineSchedule;
  pack_size?: string;
  unit?: string;
  strength?: string;
  mrp: number;
  composition?: string;
  uses?: string[];
  side_effects?: string[];
  is_prescription_required: boolean;
  is_available: boolean;
  is_discontinued: boolean;
  image_url?: string;
  stock_quantity: number;
  is_in_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PharmacyInventory {
  id: string;
  pharmacy_id: string;
  medicine_id: string;
  quantity_available: number;
  quantity_reserved: number;
  selling_price: number;
  discount_percent: number;
  batch_number?: string;
  expiry_date?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicineOrder {
  id: string;
  order_number: string;
  patient_id: string;
  family_member_id?: string;
  prescription_id?: string;
  appointment_id?: string;
  fulfillment_type: FulfillmentType;
  pharmacy_id?: string;
  delivery_address?: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    country?: string;
    phone?: string;
    lat?: number;
    lng?: number;
  };
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  pharmacy_amount?: number;
  platform_commission?: number;
  status: MedicineOrderStatus;
  prescription_verified: boolean;
  delivery_partner_id?: string;
  delivery_tracking_id?: string;
  delivery_otp?: string;
  payment_status: PaymentStatus;
  payment_id?: string;
  rating?: number;
  rating_comment?: string;
  idempotency_key?: string;
  placed_at: string;
  confirmed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineOrderItem {
  id: string;
  order_id: string;
  medicine_id: string;
  inventory_id?: string;
  prescription_item_index?: number;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  medicine_name: string;
  medicine_brand?: string;
  dosage?: string;
  is_substitute: boolean;
  original_medicine_id?: string;
  substitution_approved: boolean;
  created_at: string;
}

export interface PharmacySettlement {
  id: string;
  pharmacy_id: string;
  settlement_period_start: string;
  settlement_period_end: string;
  total_orders: number;
  total_order_value: number;
  total_platform_commission: number;
  total_delivery_fees: number;
  total_refunds: number;
  net_settlement: number;
  bank_reference?: string;
  transfer_id?: string;
  status: SettlementStatus;
  invoice_number?: string;
  invoice_url?: string;
  calculated_at: string;
  initiated_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface HospitalStaff {
  id: string;
  hospital_id: string;
  user_id: string;
  staff_role: HospitalStaffRole;
  can_book_appointments: boolean;
  can_view_patient_records: boolean;
  can_manage_schedules: boolean;
  can_process_payments: boolean;
  can_manage_inventory: boolean;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryTracking {
  id: string;
  order_id: string;
  status: string;
  status_message?: string;
  location?: { lat: number; lng: number };
  event_time: string;
  source: string;
  created_at: string;
}

// Legacy type aliases for backward compatibility
export type OTPCode = OtpCode;

// Helper type for Insert operations (makes id and timestamps optional)
type InsertRow<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// Helper type for Update operations (all fields optional except id)
type UpdateRow<T> = Partial<T> & { id?: string };

// Supabase Database interface for type-safe queries
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: InsertRow<User>;
        Update: UpdateRow<User>;
        Relationships: [];
      };
      doctors: {
        Row: Doctor;
        Insert: InsertRow<Doctor>;
        Update: UpdateRow<Doctor>;
        Relationships: [
          { foreignKeyName: 'doctors_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; },
          { foreignKeyName: 'doctors_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id']; }
        ];
      };
      hospitals: {
        Row: Hospital;
        Insert: InsertRow<Hospital>;
        Update: UpdateRow<Hospital>;
        Relationships: [];
      };
      appointments: {
        Row: Appointment;
        Insert: InsertRow<Appointment>;
        Update: UpdateRow<Appointment>;
        Relationships: [
          { foreignKeyName: 'appointments_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id']; },
          { foreignKeyName: 'appointments_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; },
          { foreignKeyName: 'appointments_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id']; }
        ];
      };
      payments: {
        Row: Payment;
        Insert: InsertRow<Payment>;
        Update: UpdateRow<Payment>;
        Relationships: [
          { foreignKeyName: 'payments_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id']; },
          { foreignKeyName: 'payments_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      prescriptions: {
        Row: Prescription;
        Insert: InsertRow<Prescription>;
        Update: UpdateRow<Prescription>;
        Relationships: [
          { foreignKeyName: 'prescriptions_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id']; },
          { foreignKeyName: 'prescriptions_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; }
        ];
      };
      refunds: {
        Row: Refund;
        Insert: InsertRow<Refund>;
        Update: UpdateRow<Refund>;
        Relationships: [
          { foreignKeyName: 'refunds_payment_id_fkey'; columns: ['payment_id']; referencedRelation: 'payments'; referencedColumns: ['id']; }
        ];
      };
      ratings: {
        Row: Rating;
        Insert: InsertRow<Rating>;
        Update: UpdateRow<Rating>;
        Relationships: [
          { foreignKeyName: 'ratings_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id']; }
        ];
      };
      notifications: {
        Row: Notification;
        Insert: InsertRow<Notification>;
        Update: UpdateRow<Notification>;
        Relationships: [
          { foreignKeyName: 'notifications_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      notification_templates: {
        Row: NotificationTemplate;
        Insert: InsertRow<NotificationTemplate>;
        Update: UpdateRow<NotificationTemplate>;
        Relationships: [];
      };
      notification_preferences: {
        Row: NotificationPreference;
        Insert: InsertRow<NotificationPreference>;
        Update: UpdateRow<NotificationPreference>;
        Relationships: [
          { foreignKeyName: 'notification_preferences_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      user_sessions: {
        Row: UserSession;
        Insert: InsertRow<UserSession>;
        Update: UpdateRow<UserSession>;
        Relationships: [
          { foreignKeyName: 'user_sessions_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      otp_codes: {
        Row: OtpCode;
        Insert: InsertRow<OtpCode>;
        Update: UpdateRow<OtpCode>;
        Relationships: [];
      };
      password_reset_tokens: {
        Row: PasswordResetToken;
        Insert: InsertRow<PasswordResetToken>;
        Update: UpdateRow<PasswordResetToken>;
        Relationships: [
          { foreignKeyName: 'password_reset_tokens_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      login_history: {
        Row: LoginHistory;
        Insert: InsertRow<LoginHistory>;
        Update: UpdateRow<LoginHistory>;
        Relationships: [
          { foreignKeyName: 'login_history_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      specializations: {
        Row: Specialization;
        Insert: InsertRow<Specialization>;
        Update: UpdateRow<Specialization>;
        Relationships: [];
      };
      doctor_schedules: {
        Row: DoctorSchedule;
        Insert: InsertRow<DoctorSchedule>;
        Update: UpdateRow<DoctorSchedule>;
        Relationships: [
          { foreignKeyName: 'doctor_schedules_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; }
        ];
      };
      schedule_overrides: {
        Row: ScheduleOverride;
        Insert: InsertRow<ScheduleOverride>;
        Update: UpdateRow<ScheduleOverride>;
        Relationships: [
          { foreignKeyName: 'schedule_overrides_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; }
        ];
      };
      appointment_slots: {
        Row: AppointmentSlot;
        Insert: InsertRow<AppointmentSlot>;
        Update: UpdateRow<AppointmentSlot>;
        Relationships: [
          { foreignKeyName: 'appointment_slots_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; }
        ];
      };
      appointment_waitlist: {
        Row: AppointmentWaitlist;
        Insert: InsertRow<AppointmentWaitlist>;
        Update: UpdateRow<AppointmentWaitlist>;
        Relationships: [
          { foreignKeyName: 'appointment_waitlist_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id']; },
          { foreignKeyName: 'appointment_waitlist_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id']; }
        ];
      };
      appointment_attachments: {
        Row: AppointmentAttachment;
        Insert: InsertRow<AppointmentAttachment>;
        Update: UpdateRow<AppointmentAttachment>;
        Relationships: [
          { foreignKeyName: 'appointment_attachments_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id']; }
        ];
      };
      family_members: {
        Row: FamilyMember;
        Insert: InsertRow<FamilyMember>;
        Update: UpdateRow<FamilyMember>;
        Relationships: [
          { foreignKeyName: 'family_members_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      patient_credits: {
        Row: PatientCredit;
        Insert: InsertRow<PatientCredit>;
        Update: UpdateRow<PatientCredit>;
        Relationships: [
          { foreignKeyName: 'patient_credits_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      credit_transactions: {
        Row: CreditTransaction;
        Insert: InsertRow<CreditTransaction>;
        Update: UpdateRow<CreditTransaction>;
        Relationships: [
          { foreignKeyName: 'credit_transactions_credit_id_fkey'; columns: ['credit_id']; referencedRelation: 'patient_credits'; referencedColumns: ['id']; }
        ];
      };
      patient_vitals: {
        Row: PatientVital;
        Insert: InsertRow<PatientVital>;
        Update: UpdateRow<PatientVital>;
        Relationships: [
          { foreignKeyName: 'patient_vitals_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      health_documents: {
        Row: HealthDocument;
        Insert: InsertRow<HealthDocument>;
        Update: UpdateRow<HealthDocument>;
        Relationships: [
          { foreignKeyName: 'health_documents_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      medication_reminders: {
        Row: MedicationReminder;
        Insert: InsertRow<MedicationReminder>;
        Update: UpdateRow<MedicationReminder>;
        Relationships: [
          { foreignKeyName: 'medication_reminders_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      medication_logs: {
        Row: MedicationLog;
        Insert: InsertRow<MedicationLog>;
        Update: UpdateRow<MedicationLog>;
        Relationships: [
          { foreignKeyName: 'medication_logs_reminder_id_fkey'; columns: ['reminder_id']; referencedRelation: 'medication_reminders'; referencedColumns: ['id']; }
        ];
      };
      hospital_settlements: {
        Row: HospitalSettlement;
        Insert: InsertRow<HospitalSettlement>;
        Update: UpdateRow<HospitalSettlement>;
        Relationships: [
          { foreignKeyName: 'hospital_settlements_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id']; }
        ];
      };
      settlement_line_items: {
        Row: SettlementLineItem;
        Insert: InsertRow<SettlementLineItem>;
        Update: UpdateRow<SettlementLineItem>;
        Relationships: [
          { foreignKeyName: 'settlement_line_items_settlement_id_fkey'; columns: ['settlement_id']; referencedRelation: 'hospital_settlements'; referencedColumns: ['id']; }
        ];
      };
      invoices: {
        Row: Invoice;
        Insert: InsertRow<Invoice>;
        Update: UpdateRow<Invoice>;
        Relationships: [];
      };
      hospital_announcements: {
        Row: HospitalAnnouncement;
        Insert: InsertRow<HospitalAnnouncement>;
        Update: UpdateRow<HospitalAnnouncement>;
        Relationships: [
          { foreignKeyName: 'hospital_announcements_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id']; }
        ];
      };
      support_tickets: {
        Row: SupportTicket;
        Insert: InsertRow<SupportTicket>;
        Update: UpdateRow<SupportTicket>;
        Relationships: [
          { foreignKeyName: 'support_tickets_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      support_ticket_messages: {
        Row: SupportTicketMessage;
        Insert: InsertRow<SupportTicketMessage>;
        Update: UpdateRow<SupportTicketMessage>;
        Relationships: [
          { foreignKeyName: 'support_ticket_messages_ticket_id_fkey'; columns: ['ticket_id']; referencedRelation: 'support_tickets'; referencedColumns: ['id']; }
        ];
      };
      consultations: {
        Row: Consultation;
        Insert: InsertRow<Consultation>;
        Update: UpdateRow<Consultation>;
        Relationships: [
          { foreignKeyName: 'consultations_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id']; }
        ];
      };
      device_tokens: {
        Row: DeviceToken;
        Insert: InsertRow<DeviceToken>;
        Update: UpdateRow<DeviceToken>;
        Relationships: [
          { foreignKeyName: 'device_tokens_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      rating_helpfulness: {
        Row: RatingHelpfulness;
        Insert: InsertRow<RatingHelpfulness>;
        Update: UpdateRow<RatingHelpfulness>;
        Relationships: [
          { foreignKeyName: 'rating_helpfulness_rating_id_fkey'; columns: ['rating_id']; referencedRelation: 'ratings'; referencedColumns: ['id']; }
        ];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: InsertRow<AuditLog>;
        Update: UpdateRow<AuditLog>;
        Relationships: [
          { foreignKeyName: 'audit_logs_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
      system_settings: {
        Row: SystemSetting;
        Insert: InsertRow<SystemSetting>;
        Update: UpdateRow<SystemSetting>;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKey;
        Insert: InsertRow<ApiKey>;
        Update: UpdateRow<ApiKey>;
        Relationships: [
          { foreignKeyName: 'api_keys_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id']; }
        ];
      };
      scheduled_notifications: {
        Row: ScheduledNotification;
        Insert: InsertRow<ScheduledNotification>;
        Update: UpdateRow<ScheduledNotification>;
        Relationships: [
          { foreignKeyName: 'scheduled_notifications_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id']; }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      gender: Gender;
      blood_group: BloodGroup;
      appointment_status: AppointmentStatus;
      consultation_type: ConsultationType;
      consultation_status: ConsultationStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      refund_type: RefundType;
      refund_status: RefundStatus;
      verification_status: VerificationStatus;
      hospital_type: HospitalType;
      subscription_tier: SubscriptionTier;
      notification_type: NotificationType;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      document_type: DocumentType;
      settlement_status: SettlementStatus;
      day_of_week: DayOfWeek;
      ticket_status: TicketStatus;
      ticket_priority: TicketPriority;
      ticket_category: TicketCategory;
      otp_purpose: OTPPurpose;
      otp_channel: OTPChannel;
      relationship_type: RelationshipType;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Type helpers for common query patterns
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

export type { definitions };
