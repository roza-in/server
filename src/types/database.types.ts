/**
 * ROZX Healthcare Platform — Database Types
 *
 * Self-contained type definitions matching migration schemas exactly.
 * When Supabase is deployed, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.generated.ts
 *
 * Source of truth: server/src/database/migrations/001–008
 */

// =============================================================================
// JSON Helper Type
// =============================================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// =============================================================================
// ENUM TYPES — from migration 001_extensions_enums.sql
// =============================================================================

// ---- User & Auth ----

export type UserRole = 'patient' | 'reception' | 'doctor' | 'hospital' | 'pharmacy' | 'admin';

export type AdminTier = 'super' | 'finance' | 'security' | 'support' | 'ops';

export type Gender = 'male' | 'female' | 'other';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';

export type OTPPurpose = 'registration' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification' | 'transaction';

export type OTPChannel = 'sms' | 'whatsapp' | 'email';

export type RelationshipType = 'self' | 'spouse' | 'parent' | 'child' | 'sibling' | 'other';

// ---- Hospital & Doctor ----

export type HospitalType =
  | 'multi_specialty'
  | 'single_specialty'
  | 'nursing_home'
  | 'clinic'
  | 'diagnostic_center'
  | 'medical_college'
  | 'primary_health';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type ScheduleOverrideType = 'holiday' | 'leave' | 'emergency' | 'special_hours';

// ---- Appointment ----

export type ConsultationType = 'online' | 'in_person' | 'walk_in';

export type AppointmentStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export type ConsultationStatus = 'scheduled' | 'waiting' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed';

export type BookingSource = 'app' | 'web' | 'reception' | 'admin';

// ---- Payment ----

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded' | 'expired' | 'disputed';

export type PaymentMethod = 'upi' | 'card' | 'net_banking' | 'wallet' | 'cash';

export type PaymentType = 'consultation' | 'medicine_order' | 'platform_fee';

export type RefundStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';

export type RefundReason =
  | 'patient_cancelled'
  | 'doctor_cancelled'
  | 'hospital_cancelled'
  | 'technical_failure'
  | 'policy_violation'
  | 'admin_override'
  | 'chargeback'
  | 'duplicate_payment'
  | 'service_not_rendered';

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'on_hold' | 'partially_paid';

// ---- Payout & Financial ----

export type PayoutStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'reversed' | 'cancelled';

export type PayoutMode = 'neft' | 'rtgs' | 'imps' | 'upi' | 'bank_transfer';

export type DisputeStatus = 'open' | 'under_review' | 'won' | 'lost' | 'accepted' | 'expired';

export type KycStatus = 'not_started' | 'pending' | 'submitted' | 'verified' | 'rejected' | 'expired';

export type LedgerEntryType = 'credit' | 'debit';

export type LedgerAccountType =
  | 'patient_payment'
  | 'platform_revenue'
  | 'hospital_payable'
  | 'pharmacy_payable'
  | 'gateway_fee'
  | 'gst_collected'
  | 'tds_deducted'
  | 'refund_outflow'
  | 'hold_funds';

export type ReconciliationStatus = 'pending' | 'matched' | 'mismatched' | 'resolved' | 'write_off';

export type WebhookProcessingStatus = 'received' | 'processing' | 'processed' | 'failed' | 'skipped';

export type SettlementFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

// ---- Pharmacy ----

export type MedicineCategory =
  | 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream'
  | 'ointment' | 'drops' | 'inhaler' | 'powder' | 'gel' | 'other';

export type MedicineSchedule = 'otc' | 'schedule_h' | 'schedule_h1' | 'schedule_x' | 'ayurvedic' | 'homeopathic';

export type MedicineOrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'packed' | 'ready_for_pickup'
  | 'dispatched' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';

export type DeliveryPartnerCode = 'rozx_delivery' | 'dunzo' | 'shadowfax' | 'porter' | 'shiprocket';

// ---- Notification ----

export type NotificationType =
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'consultation_started'
  | 'consultation_ended'
  | 'waiting_room_ready'
  | 'payment_success'
  | 'payment_failed'
  | 'refund_initiated'
  | 'refund_completed'
  | 'prescription_ready'
  | 'medicine_order_confirmed'
  | 'medicine_dispatched'
  | 'medicine_delivered'
  | 'verification_approved'
  | 'verification_rejected'
  | 'settlement_processed'
  | 'payout_completed'
  | 'dispute_raised'
  | 'welcome'
  | 'general';

export type NotificationChannel = 'sms' | 'whatsapp' | 'email' | 'push' | 'in_app';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// ---- Support ----

export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketCategory = 'appointment' | 'payment' | 'refund' | 'medicine_order' | 'technical' | 'feedback' | 'other';

// ---- Document ----

export type DocumentType =
  | 'prescription' | 'lab_report' | 'imaging' | 'medical_certificate'
  | 'discharge_summary' | 'insurance_document' | 'vaccination_record' | 'other';

// ---- Audit ----

export type AuditAction =
  | 'create' | 'read' | 'update' | 'delete'
  | 'login' | 'logout' | 'payment' | 'refund'
  | 'status_change' | 'verification'
  | 'payout' | 'settlement' | 'dispute';

// =============================================================================
// NON-DB TYPES — Used in business logic but not DB enums
// =============================================================================

/** Business-level subscription concept; not a DB enum */
export type SubscriptionTier = 'free' | 'standard' | 'premium' | 'enterprise';

/** Used in medicine order flow; not a DB enum */
export type FulfillmentType = 'platform_delivery' | 'pharmacy_pickup' | 'self_arrange' | 'hospital_pharmacy';

// =============================================================================
// TABLE ROW TYPES — from migrations 002–008
// =============================================================================

// ======================== Migration 002: Users & Auth ========================

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  role: UserRole;
  admin_tier: AdminTier | null;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  blood_group: BloodGroup | null;
  address: Json | null;
  medical_conditions: string[] | null;
  allergies: string[] | null;
  emergency_contact: Json | null;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  verification_status: VerificationStatus;
  verified_at: string | null;
  last_login_at: string | null;
  login_count: number;
  search_vector: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  relationship: RelationshipType;
  date_of_birth: string | null;
  gender: Gender | null;
  blood_group: BloodGroup | null;
  medical_conditions: string[] | null;
  allergies: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_id: string | null;
  device_type: string | null;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  expires_at: string;
  last_used_at: string;
  created_at: string;
}

export interface OtpCode {
  id: string;
  identifier: string;
  channel: OTPChannel;
  purpose: OTPPurpose;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface LoginHistory {
  id: string;
  user_id: string | null;
  identifier: string;
  method: string;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Json | null;
  created_at: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ======================== Migration 003: Hospitals & Doctors ========================

export interface Specialization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  common_conditions: string[] | null;
  search_keywords: string[] | null;
  faq_content: Json | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Hospital {
  id: string;
  admin_user_id: string;
  name: string;
  slug: string | null;
  type: HospitalType;
  description: string | null;
  email: string | null;
  phone: string;
  alternate_phone: string | null;
  website: string | null;
  address: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  location: Json | null;
  registration_number: string | null;
  gstin: string | null;
  pan: string | null;
  facilities: string[] | null;
  logo_url: string | null;
  banner_url: string | null;
  photos: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  short_description: string | null;
  meta_keywords: string[] | null;
  og_image_url: string | null;
  canonical_slug: string | null;
  noindex: boolean;
  last_content_update: string | null;
  schema_type: string;
  founding_year: number | null;
  number_of_employees: string | null;
  accepted_insurance: string[] | null;
  payment_methods_accepted: string[] | null;
  area_served: string[] | null;
  also_known_as: string[] | null;
  accreditations: string[] | null;
  departments: string[] | null;
  languages_spoken: string[];
  emergency_services: boolean;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  faq_content: Json | null;
  social_links: Json | null;
  working_hours: Json | null;
  platform_commission_percent: number;
  medicine_commission_percent: number;
  commission_slab_id: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  is_active: boolean;
  rating: number;
  total_ratings: number;
  total_doctors: number;
  total_appointments: number;
  search_vector: string | null;
  created_at: string;
  updated_at: string;
}

export interface HospitalStaff {
  id: string;
  hospital_id: string;
  user_id: string;
  staff_role: string;
  designation: string | null;
  can_book_appointments: boolean;
  can_mark_payments: boolean;
  can_view_patient_info: boolean;
  can_print_documents: boolean;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  user_id: string;
  hospital_id: string;
  specialization_id: string;
  additional_specializations: string[] | null;
  registration_number: string;
  registration_council: string | null;
  registration_year: number | null;
  qualifications: string[] | null;
  experience_years: number;
  bio: string | null;
  short_bio: string | null;
  languages: string[];
  consultation_languages: string[] | null;
  slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  og_image_url: string | null;
  profile_video_url: string | null;
  noindex: boolean;
  last_content_update: string | null;
  featured: boolean;
  npi_number: string | null;
  medical_specialty_schema: string[] | null;
  available_service: string[] | null;
  hospital_affiliation: string[] | null;
  education: Json | null;
  conditions_treated: string[] | null;
  procedures_performed: string[] | null;
  expertise_areas: string[] | null;
  awards: string[] | null;
  publications: string[] | null;
  certifications: string[] | null;
  memberships: string[] | null;
  faq_content: Json | null;
  social_profiles: Json | null;
  consultation_types: ConsultationType[];
  online_consultation_enabled: boolean;
  walk_in_enabled: boolean;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  consultation_fee_walk_in: number;
  follow_up_fee: number;
  follow_up_validity_days: number;
  slot_duration_minutes: number;
  buffer_time_minutes: number;
  max_patients_per_slot: number;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  is_active: boolean;
  is_available: boolean;
  rating: number;
  total_ratings: number;
  total_consultations: number;
  search_vector: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: DayOfWeek;
  consultation_type: ConsultationType;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number | null;
  max_patients_per_slot: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleOverride {
  id: string;
  doctor_id: string;
  override_date: string;
  override_type: ScheduleOverrideType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

// ======================== Migration 004: Appointments & Consultations ========================

export interface AppointmentSlot {
  id: string;
  doctor_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  consultation_type: ConsultationType;
  max_bookings: number;
  current_bookings: number;
  locked_until: string | null;
  locked_by: string | null;
  lock_version: number;
  is_available: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  appointment_number: string | null;
  patient_id: string;
  family_member_id: string | null;
  doctor_id: string;
  hospital_id: string;
  slot_id: string | null;
  consultation_type: ConsultationType;
  booking_source: BookingSource;
  walk_in_token: string | null;
  booked_by_user_id: string | null;
  scheduled_date: string;
  scheduled_start: string;
  scheduled_end: string;
  checked_in_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: AppointmentStatus;
  status_reason: string | null;
  consultation_fee: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  platform_commission: number;
  hospital_amount: number;
  payment_method: PaymentMethod | null;
  payment_collected_by: string | null;
  payment_collected_at: string | null;
  idempotency_key: string | null;
  is_follow_up: boolean;
  parent_appointment_id: string | null;
  follow_up_valid_until: string | null;
  reschedule_count: number;
  rescheduled_from: string | null;
  patient_notes: string | null;
  internal_notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  // Added by migration 005
  payment_id: string | null;
  payment_status: PaymentStatus | null;
  // Added by migration 006
  settlement_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  appointment_id: string;
  status: ConsultationStatus;
  room_id: string | null;
  room_url: string | null;
  room_token: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  chief_complaint: string | null;
  history_of_illness: string | null;
  examination_findings: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  vitals: Json | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  follow_up_days: number | null;
  attachments: Json | null;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  prescription_number: string | null;
  consultation_id: string;
  doctor_id: string;
  patient_id: string;
  hospital_id: string;
  diagnosis: string[] | null;
  medications: Json;
  diet_advice: string | null;
  lifestyle_advice: string | null;
  general_instructions: string | null;
  lab_tests: string[] | null;
  imaging_tests: string[] | null;
  valid_until: string | null;
  is_digital: boolean;
  is_downloaded: boolean;
  download_count: number;
  medicine_ordered: boolean;
  medicine_order_id: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string;
  rating: number;
  review: string | null;
  doctor_rating: number | null;
  hospital_rating: number | null;
  wait_time_rating: number | null;
  is_visible: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

export interface HealthDocument {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  document_date: string | null;
  hospital_name: string | null;
  doctor_name: string | null;
  appointment_id: string | null;
  consultation_id: string | null;
  is_shared: boolean;
  shared_doctors: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentAttachment {
  id: string;
  appointment_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PatientVital {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  consultation_id: string | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  pulse_rate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  spo2: number | null;
  blood_sugar_fasting: number | null;
  blood_sugar_pp: number | null;
  bmi: number | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
}

export interface MedicationReminder {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  prescription_id: string | null;
  medicine_id: string | null;
  medicine_name: string;
  dosage: string | null;
  instructions: string | null;
  frequency: string;
  reminder_times: string[];
  meal_timing: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  reminder_id: string;
  patient_id: string;
  scheduled_time: string;
  status: string;
  taken_at: string | null;
  skipped_reason: string | null;
  created_at: string;
}

export interface AppointmentWaitlist {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string;
  consultation_type: ConsultationType;
  preferred_date: string;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  status: string;
  notified_at: string | null;
  booked_appointment_id: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ======================== Migration 005: Payments & Refunds ========================

export interface Payment {
  id: string;
  payment_number: string | null;
  payment_type: PaymentType;
  appointment_id: string | null;
  medicine_order_id: string | null;
  payer_user_id: string;
  hospital_id: string | null;
  base_amount: number;
  platform_fee: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  platform_commission: number;
  commission_rate: number;
  net_payable: number;
  total_refunded: number;
  currency: string;
  payment_method: PaymentMethod;
  gateway_provider: string | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  gateway_response: Json | null;
  cash_collected_by: string | null;
  cash_collected_at: string | null;
  cash_receipt_number: string | null;
  status: PaymentStatus;
  status_reason: string | null;
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  idempotency_key: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentStateLog {
  id: string;
  payment_id: string;
  from_status: PaymentStatus | null;
  to_status: PaymentStatus;
  changed_by: string | null;
  change_source: string;
  reason: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface Refund {
  id: string;
  refund_number: string | null;
  payment_id: string;
  refund_amount: number;
  reason: RefundReason;
  reason_details: string | null;
  cancellation_fee: number;
  policy_applied: string | null;
  status: RefundStatus;
  status_reason: string | null;
  initiated_by: string;
  initiated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  gateway_refund_id: string | null;
  gateway_response: Json | null;
  completed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface GstLedger {
  id: string;
  transaction_type: string;
  transaction_id: string;
  transaction_number: string | null;
  invoice_number: string | null;
  invoice_date: string;
  seller_gstin: string | null;
  seller_name: string | null;
  buyer_gstin: string | null;
  buyer_name: string | null;
  place_of_supply: string;
  hsn_sac_code: string;
  description: string | null;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  is_credit: boolean;
  is_filed: boolean;
  filed_in_return: string | null;
  filing_date: string | null;
  transaction_date: string;
  created_at: string;
}

export interface GatewayWebhookEvent {
  id: string;
  gateway_provider: string;
  gateway_event_id: string;
  event_type: string;
  payload: Json;
  status: WebhookProcessingStatus;
  processing_started_at: string | null;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  payment_id: string | null;
  refund_id: string | null;
  signature_verified: boolean;
  received_at: string;
  created_at: string;
}

export interface PaymentDispute {
  id: string;
  payment_id: string;
  dispute_type: string;
  gateway_dispute_id: string | null;
  amount: number;
  reason: string;
  status: DisputeStatus;
  evidence_submitted: Json | null;
  evidence_due_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  amount_deducted: number;
  gateway_response: Json | null;
  created_at: string;
  updated_at: string;
}

// ======================== Migration 006: Settlements & Payouts ========================

export interface PayoutAccount {
  id: string;
  hospital_id: string;
  gateway_provider: string;
  gateway_account_id: string;
  gateway_contact_id: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_masked: string | null;
  ifsc_code: string | null;
  kyc_status: KycStatus;
  kyc_verified_at: string | null;
  settlement_frequency: SettlementFrequency | null;
  min_payout_amount: number;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settlement {
  id: string;
  settlement_number: string | null;
  entity_type: string;
  entity_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  refunds_amount: number;
  commission_amount: number;
  tds_amount: number;
  other_deductions: number;
  deduction_details: Json | null;
  net_payable: number;
  payout_account_id: string | null;
  payment_mode: string | null;
  utr_number: string | null;
  status: SettlementStatus;
  status_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementLineItem {
  id: string;
  settlement_id: string;
  transaction_type: string;
  transaction_id: string;
  transaction_date: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  description: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  payout_number: string | null;
  settlement_id: string;
  payout_account_id: string;
  amount: number;
  currency: string;
  payout_mode: PayoutMode;
  gateway_provider: string;
  gateway_payout_id: string | null;
  gateway_response: Json | null;
  status: PayoutStatus;
  status_reason: string | null;
  utr_number: string | null;
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  reversed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutItem {
  id: string;
  payout_id: string;
  settlement_line_item_id: string;
  amount: number;
  created_at: string;
}

export interface FinancialLedger {
  id: string;
  reference_type: string;
  reference_id: string;
  entry_type: LedgerEntryType;
  account_type: LedgerAccountType;
  amount: number;
  running_balance: number;
  description: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface HoldFund {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  related_payment_id: string | null;
  related_dispute_id: string | null;
  amount: number;
  is_active: boolean;
  released_at: string | null;
  released_by: string | null;
  release_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationRecord {
  id: string;
  reconciliation_date: string;
  gateway_provider: string;
  gateway_transaction_id: string;
  gateway_amount: number;
  gateway_status: string | null;
  internal_payment_id: string | null;
  internal_amount: number | null;
  status: ReconciliationStatus;
  discrepancy_amount: number;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommissionSlab {
  id: string;
  name: string;
  description: string | null;
  min_monthly_revenue: number;
  max_monthly_revenue: number | null;
  consultation_commission_percent: number;
  medicine_commission_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailySettlementSummary {
  id: string;
  summary_date: string;
  entity_type: string;
  entity_id: string;
  total_payments: number;
  total_payment_amount: number;
  total_refunds: number;
  total_refund_amount: number;
  total_commission: number;
  net_payable: number;
  is_settled: boolean;
  settlement_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementInvoice {
  id: string;
  settlement_id: string;
  invoice_number: string;
  invoice_date: string;
  gross_amount: number;
  commission_amount: number;
  tds_amount: number;
  net_payable: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  pdf_url: string | null;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface PlatformConfig {
  id: string;
  config_key: string;
  config_value: Json;
  description: string | null;
  config_type: string;
  updated_by: string | null;
  previous_value: Json | null;
  created_at: string;
  updated_at: string;
}

export interface CancellationPolicy {
  id: string;
  name: string;
  description: string | null;
  free_cancellation_hours: number;
  partial_refund_hours: number;
  partial_refund_percent: number;
  cancellation_fee_fixed: number;
  cancellation_fee_percent: number;
  applies_to_online: boolean;
  applies_to_in_person: boolean;
  applies_to_walk_in: boolean;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ======================== Migration 007: Pharmacy ========================

export interface Medicine {
  id: string;
  sku: string;
  name: string;
  generic_name: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: MedicineCategory;
  schedule: MedicineSchedule;
  composition: string | null;
  strength: string | null;
  pack_size: string | null;
  mrp: number;
  selling_price: number;
  discount_percent: number;
  hospital_commission_percent: number;
  is_prescription_required: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  is_in_stock: boolean;
  is_active: boolean;
  is_discontinued: boolean;
  description: string | null;
  usage_instructions: string | null;
  side_effects: string | null;
  contraindications: string | null;
  drug_interactions: string | null;
  storage_instructions: string | null;
  slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_url: string | null;
  images: string[] | null;
  hsn_code: string | null;
  gst_percent: number;
  search_keywords: string[] | null;
  search_vector: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicineOrder {
  id: string;
  order_number: string | null;
  prescription_id: string | null;
  patient_id: string;
  family_member_id: string | null;
  hospital_id: string | null;
  delivery_address: Json;
  status: MedicineOrderStatus;
  status_history: Json;
  items_total: number;
  discount_amount: number;
  delivery_fee: number;
  gst_amount: number;
  total_amount: number;
  hospital_commission: number;
  platform_commission: number;
  requires_prescription: boolean;
  prescription_verified: boolean;
  prescription_verified_by: string | null;
  prescription_verified_at: string | null;
  prescription_rejection_reason: string | null;
  delivery_partner: DeliveryPartnerCode | null;
  delivery_tracking_id: string | null;
  delivery_tracking_url: string | null;
  estimated_delivery_at: string | null;
  delivery_otp: string | null;
  placed_at: string;
  confirmed_at: string | null;
  packed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  payment_status: PaymentStatus;
  payment_id: string | null;
  patient_notes: string | null;
  internal_notes: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicineOrderItem {
  id: string;
  order_id: string;
  medicine_id: string;
  prescription_item_index: number | null;
  quantity: number;
  unit_mrp: number;
  unit_selling_price: number;
  discount_percent: number;
  subtotal: number;
  medicine_name: string;
  medicine_brand: string | null;
  medicine_strength: string | null;
  medicine_pack_size: string | null;
  requires_prescription: boolean;
  is_substitute: boolean;
  original_medicine_id: string | null;
  substitution_approved: boolean;
  created_at: string;
}

export interface DeliveryTracking {
  id: string;
  order_id: string;
  status: string;
  status_message: string | null;
  location: Json | null;
  source: string;
  external_status: string | null;
  event_time: string;
}

export interface MedicineReturn {
  id: string;
  return_number: string | null;
  order_id: string;
  reason: string;
  reason_details: string | null;
  items: Json;
  photos: string[] | null;
  refund_amount: number;
  status: string;
  initiated_by: string;
  initiated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  pickup_scheduled_at: string | null;
  pickup_completed_at: string | null;
  refund_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacySettlement {
  id: string;
  settlement_number: string | null;
  hospital_id: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  total_order_value: number;
  commission_rate: number;
  gross_commission: number;
  tds_amount: number;
  other_deductions: number;
  deduction_details: Json | null;
  net_payable: number;
  status: SettlementStatus;
  processed_by: string | null;
  processed_at: string | null;
  payment_mode: string | null;
  utr_number: string | null;
  created_at: string;
  updated_at: string;
}

// ======================== Migration 008: Notifications, Support & Audit ========================

export interface NotificationTemplate {
  id: string;
  code: string;
  type: NotificationType;
  title: string;
  body: string;
  sms_template: string | null;
  whatsapp_template: string | null;
  email_subject: string | null;
  email_body: string | null;
  push_title: string | null;
  push_body: string | null;
  variables: string[] | null;
  channels: NotificationChannel[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  template_id: string | null;
  title: string;
  body: string;
  data: Json | null;
  action_url: string | null;
  action_type: string | null;
  appointment_id: string | null;
  medicine_order_id: string | null;
  payment_id: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  external_id: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  push_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  appointment_reminders: boolean;
  payment_updates: boolean;
  order_updates: boolean;
  promotional: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string | null;
  user_id: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  appointment_id: string | null;
  medicine_order_id: string | null;
  payment_id: string | null;
  attachments: string[] | null;
  status: TicketStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  satisfaction_rating: number | null;
  satisfaction_feedback: string | null;
  first_response_at: string | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: UserRole;
  message: string;
  attachments: string[] | null;
  is_internal: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_role: UserRole | null;
  action: AuditAction;
  description: string | null;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  changes: Json | null;
  metadata: Json | null;
  accessed_phi: boolean;
  phi_fields: string[] | null;
  created_at: string;
}

export interface SystemLog {
  id: string;
  level: string;
  message: string;
  module: string | null;
  function_name: string | null;
  request_id: string | null;
  correlation_id: string | null;
  error_code: string | null;
  error_stack: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string | null;
  hospital_id: string | null;
  key_prefix: string;
  key_hash: string;
  name: string;
  description: string | null;
  scopes: string[];
  last_used_at: string | null;
  request_count: number;
  rate_limit_per_minute: number;
  expires_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Json | null;
  appointment_id: string | null;
  medicine_order_id: string | null;
  medication_reminder_id: string | null;
  scheduled_for: string;
  channels: NotificationChannel[];
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface NotificationQueue {
  id: string;
  notification_id: string | null;
  channel: NotificationChannel;
  recipient: string;
  payload: Json;
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  priority: number;
  scheduled_for: string;
  processed_at: string | null;
  created_at: string;
}

export interface HospitalVerificationRequest {
  id: string;
  hospital_id: string;
  requested_by: string;
  registration_certificate_url: string | null;
  license_url: string | null;
  gstin_certificate_url: string | null;
  photos: string[] | null;
  additional_documents: Json | null;
  status: VerificationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  review_notes: string | null;
  resubmission_count: number;
  previous_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  entity_type: string | null;
  entity_id: string | null;
  frequency: string;
  next_run_at: string;
  last_run_at: string | null;
  recipients: string[];
  created_by: string;
  report_config: Json;
  output_format: string;
  is_active: boolean;
  last_report_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface HospitalAnnouncement {
  id: string;
  hospital_id: string;
  created_by: string;
  title: string;
  content: string;
  type: string;
  is_public: boolean;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  target_roles: UserRole[];
  created_at: string;
  updated_at: string;
}

export interface RatingHelpfulness {
  id: string;
  rating_id: string;
  user_id: string;
  is_helpful: boolean;
  created_at: string;
}

export interface PatientCredit {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  credit_account_id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PatientMedication {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  medication_name: string;
  generic_name: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  prescribed_by: string | null;
  prescription_id: string | null;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientAllergy {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  allergen: string;
  allergen_type: string;
  severity: string;
  reaction: string | null;
  onset_date: string | null;
  diagnosed_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientMedicalCondition {
  id: string;
  patient_id: string;
  family_member_id: string | null;
  condition_name: string;
  icd_code: string | null;
  severity: string;
  status: string;
  diagnosed_date: string | null;
  diagnosed_by: string | null;
  resolved_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// BACKWARD-COMPATIBLE ALIASES
// =============================================================================

/** @deprecated Table is `settlements` — use Settlement */
export type HospitalSettlement = Settlement;

/** @deprecated Table is `settlement_invoices` — use SettlementInvoice */
export type Invoice = SettlementInvoice;

/** @deprecated Table is `ticket_messages` — use TicketMessage */
export type SupportTicketMessage = TicketMessage;

/** @deprecated Table is `platform_config` — use PlatformConfig */
export type SystemSetting = PlatformConfig;

/** @deprecated Use OTPPurpose */
export type OtpPurpose = OTPPurpose;

/** Legacy alias */
export type OTPCode = OtpCode;

/** @deprecated DB enum is `refund_reason` — use RefundReason */
export type RefundType = RefundReason;

// =============================================================================
// PHANTOM INTERFACES — No DB table, used in business logic only
// =============================================================================

/**
 * Pharmacy interface for business logic.
 * ROZX uses a centralized pharmacy model — no `pharmacies` table exists.
 */
export interface Pharmacy {
  id: string;
  name: string;
  slug: string | null;
  hospital_id: string | null;
  drug_license_number: string;
  gst_number: string | null;
  phone: string;
  email: string | null;
  address: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  location: Json | null;
  working_hours: Json | null;
  is_24x7: boolean;
  home_delivery: boolean;
  min_order_amount: number;
  delivery_radius_km: number;
  platform_commission_percent: number;
  is_active: boolean;
  verification_status: VerificationStatus;
  rating: number;
  total_orders: number;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Delivery partner interface for business logic.
 * No `delivery_partners` table — partners are tracked via `delivery_partner_code` enum.
 */
export interface DeliveryPartner {
  id: string;
  name: string;
  code: DeliveryPartnerCode;
  logo_url: string | null;
  api_endpoint: string | null;
  service_cities: string[] | null;
  base_delivery_fee: number;
  per_km_fee: number;
  max_delivery_distance_km: number;
  avg_pickup_time_minutes: number;
  avg_delivery_time_minutes: number;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Pharmacy inventory interface for business logic.
 * No `pharmacy_inventory` table — inventory tracked via `medicines.stock_quantity`.
 */
export interface PharmacyInventory {
  id: string;
  pharmacy_id: string;
  medicine_id: string;
  quantity_available: number;
  quantity_reserved: number;
  selling_price: number;
  discount_percent: number;
  batch_number: string | null;
  expiry_date: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/** Make id and timestamps optional for INSERT */
type InsertRow<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

/** All fields optional for UPDATE */
type UpdateRow<T> = Partial<T> & { id?: string };

// =============================================================================
// DATABASE INTERFACE — Supabase-compatible
// =============================================================================

export interface Database {
  public: {
    Tables: {
      // --- Migration 002: Users & Auth ---
      users: { Row: User; Insert: InsertRow<User>; Update: UpdateRow<User>; Relationships: [] };
      family_members: {
        Row: FamilyMember; Insert: InsertRow<FamilyMember>; Update: UpdateRow<FamilyMember>;
        Relationships: [{ foreignKeyName: 'family_members_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      user_sessions: {
        Row: UserSession; Insert: InsertRow<UserSession>; Update: UpdateRow<UserSession>;
        Relationships: [{ foreignKeyName: 'user_sessions_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      otp_codes: { Row: OtpCode; Insert: InsertRow<OtpCode>; Update: UpdateRow<OtpCode>; Relationships: [] };
      password_reset_tokens: {
        Row: PasswordResetToken; Insert: InsertRow<PasswordResetToken>; Update: UpdateRow<PasswordResetToken>;
        Relationships: [{ foreignKeyName: 'password_reset_tokens_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      login_history: {
        Row: LoginHistory; Insert: InsertRow<LoginHistory>; Update: UpdateRow<LoginHistory>;
        Relationships: [{ foreignKeyName: 'login_history_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      device_tokens: {
        Row: DeviceToken; Insert: InsertRow<DeviceToken>; Update: UpdateRow<DeviceToken>;
        Relationships: [{ foreignKeyName: 'device_tokens_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      // --- Migration 003: Hospitals & Doctors ---
      specializations: { Row: Specialization; Insert: InsertRow<Specialization>; Update: UpdateRow<Specialization>; Relationships: [] };
      hospitals: { Row: Hospital; Insert: InsertRow<Hospital>; Update: UpdateRow<Hospital>; Relationships: [] };
      hospital_staff: {
        Row: HospitalStaff; Insert: InsertRow<HospitalStaff>; Update: UpdateRow<HospitalStaff>;
        Relationships: [
          { foreignKeyName: 'hospital_staff_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] },
          { foreignKeyName: 'hospital_staff_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }
        ];
      };
      doctors: {
        Row: Doctor; Insert: InsertRow<Doctor>; Update: UpdateRow<Doctor>;
        Relationships: [
          { foreignKeyName: 'doctors_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'doctors_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }
        ];
      };
      doctor_schedules: {
        Row: DoctorSchedule; Insert: InsertRow<DoctorSchedule>; Update: UpdateRow<DoctorSchedule>;
        Relationships: [{ foreignKeyName: 'doctor_schedules_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] }];
      };
      schedule_overrides: {
        Row: ScheduleOverride; Insert: InsertRow<ScheduleOverride>; Update: UpdateRow<ScheduleOverride>;
        Relationships: [{ foreignKeyName: 'schedule_overrides_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] }];
      };
      // --- Migration 004: Appointments & Consultations ---
      appointment_slots: {
        Row: AppointmentSlot; Insert: InsertRow<AppointmentSlot>; Update: UpdateRow<AppointmentSlot>;
        Relationships: [{ foreignKeyName: 'appointment_slots_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] }];
      };
      appointments: {
        Row: Appointment; Insert: InsertRow<Appointment>; Update: UpdateRow<Appointment>;
        Relationships: [
          { foreignKeyName: 'appointments_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointments_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointments_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }
        ];
      };
      consultations: {
        Row: Consultation; Insert: InsertRow<Consultation>; Update: UpdateRow<Consultation>;
        Relationships: [{ foreignKeyName: 'consultations_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id'] }];
      };
      prescriptions: {
        Row: Prescription; Insert: InsertRow<Prescription>; Update: UpdateRow<Prescription>;
        Relationships: [
          { foreignKeyName: 'prescriptions_consultation_id_fkey'; columns: ['consultation_id']; referencedRelation: 'consultations'; referencedColumns: ['id'] },
          { foreignKeyName: 'prescriptions_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] }
        ];
      };
      ratings: {
        Row: Rating; Insert: InsertRow<Rating>; Update: UpdateRow<Rating>;
        Relationships: [{ foreignKeyName: 'ratings_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id'] }];
      };
      health_documents: {
        Row: HealthDocument; Insert: InsertRow<HealthDocument>; Update: UpdateRow<HealthDocument>;
        Relationships: [{ foreignKeyName: 'health_documents_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      appointment_attachments: {
        Row: AppointmentAttachment; Insert: InsertRow<AppointmentAttachment>; Update: UpdateRow<AppointmentAttachment>;
        Relationships: [{ foreignKeyName: 'appointment_attachments_appointment_id_fkey'; columns: ['appointment_id']; referencedRelation: 'appointments'; referencedColumns: ['id'] }];
      };
      patient_vitals: {
        Row: PatientVital; Insert: InsertRow<PatientVital>; Update: UpdateRow<PatientVital>;
        Relationships: [{ foreignKeyName: 'patient_vitals_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      medication_reminders: {
        Row: MedicationReminder; Insert: InsertRow<MedicationReminder>; Update: UpdateRow<MedicationReminder>;
        Relationships: [{ foreignKeyName: 'medication_reminders_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      medication_logs: {
        Row: MedicationLog; Insert: InsertRow<MedicationLog>; Update: UpdateRow<MedicationLog>;
        Relationships: [{ foreignKeyName: 'medication_logs_reminder_id_fkey'; columns: ['reminder_id']; referencedRelation: 'medication_reminders'; referencedColumns: ['id'] }];
      };
      appointment_waitlist: {
        Row: AppointmentWaitlist; Insert: InsertRow<AppointmentWaitlist>; Update: UpdateRow<AppointmentWaitlist>;
        Relationships: [
          { foreignKeyName: 'appointment_waitlist_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointment_waitlist_doctor_id_fkey'; columns: ['doctor_id']; referencedRelation: 'doctors'; referencedColumns: ['id'] }
        ];
      };
      // --- Migration 005: Payments & Refunds ---
      payments: {
        Row: Payment; Insert: InsertRow<Payment>; Update: UpdateRow<Payment>;
        Relationships: [{ foreignKeyName: 'payments_payer_user_id_fkey'; columns: ['payer_user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      payment_state_log: {
        Row: PaymentStateLog; Insert: InsertRow<PaymentStateLog>; Update: UpdateRow<PaymentStateLog>;
        Relationships: [{ foreignKeyName: 'payment_state_log_payment_id_fkey'; columns: ['payment_id']; referencedRelation: 'payments'; referencedColumns: ['id'] }];
      };
      refunds: {
        Row: Refund; Insert: InsertRow<Refund>; Update: UpdateRow<Refund>;
        Relationships: [{ foreignKeyName: 'refunds_payment_id_fkey'; columns: ['payment_id']; referencedRelation: 'payments'; referencedColumns: ['id'] }];
      };
      gst_ledger: { Row: GstLedger; Insert: InsertRow<GstLedger>; Update: UpdateRow<GstLedger>; Relationships: [] };
      gateway_webhook_events: { Row: GatewayWebhookEvent; Insert: InsertRow<GatewayWebhookEvent>; Update: UpdateRow<GatewayWebhookEvent>; Relationships: [] };
      payment_disputes: {
        Row: PaymentDispute; Insert: InsertRow<PaymentDispute>; Update: UpdateRow<PaymentDispute>;
        Relationships: [{ foreignKeyName: 'payment_disputes_payment_id_fkey'; columns: ['payment_id']; referencedRelation: 'payments'; referencedColumns: ['id'] }];
      };
      // --- Migration 006: Settlements & Payouts ---
      payout_accounts: {
        Row: PayoutAccount; Insert: InsertRow<PayoutAccount>; Update: UpdateRow<PayoutAccount>;
        Relationships: [{ foreignKeyName: 'payout_accounts_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }];
      };
      settlements: { Row: Settlement; Insert: InsertRow<Settlement>; Update: UpdateRow<Settlement>; Relationships: [] };
      settlement_line_items: {
        Row: SettlementLineItem; Insert: InsertRow<SettlementLineItem>; Update: UpdateRow<SettlementLineItem>;
        Relationships: [{ foreignKeyName: 'settlement_line_items_settlement_id_fkey'; columns: ['settlement_id']; referencedRelation: 'settlements'; referencedColumns: ['id'] }];
      };
      payouts: {
        Row: Payout; Insert: InsertRow<Payout>; Update: UpdateRow<Payout>;
        Relationships: [
          { foreignKeyName: 'payouts_settlement_id_fkey'; columns: ['settlement_id']; referencedRelation: 'settlements'; referencedColumns: ['id'] },
          { foreignKeyName: 'payouts_payout_account_id_fkey'; columns: ['payout_account_id']; referencedRelation: 'payout_accounts'; referencedColumns: ['id'] }
        ];
      };
      payout_items: {
        Row: PayoutItem; Insert: InsertRow<PayoutItem>; Update: UpdateRow<PayoutItem>;
        Relationships: [{ foreignKeyName: 'payout_items_payout_id_fkey'; columns: ['payout_id']; referencedRelation: 'payouts'; referencedColumns: ['id'] }];
      };
      financial_ledger: { Row: FinancialLedger; Insert: InsertRow<FinancialLedger>; Update: UpdateRow<FinancialLedger>; Relationships: [] };
      hold_funds: { Row: HoldFund; Insert: InsertRow<HoldFund>; Update: UpdateRow<HoldFund>; Relationships: [] };
      reconciliation_records: { Row: ReconciliationRecord; Insert: InsertRow<ReconciliationRecord>; Update: UpdateRow<ReconciliationRecord>; Relationships: [] };
      commission_slabs: { Row: CommissionSlab; Insert: InsertRow<CommissionSlab>; Update: UpdateRow<CommissionSlab>; Relationships: [] };
      daily_settlement_summary: { Row: DailySettlementSummary; Insert: InsertRow<DailySettlementSummary>; Update: UpdateRow<DailySettlementSummary>; Relationships: [] };
      settlement_invoices: {
        Row: SettlementInvoice; Insert: InsertRow<SettlementInvoice>; Update: UpdateRow<SettlementInvoice>;
        Relationships: [{ foreignKeyName: 'settlement_invoices_settlement_id_fkey'; columns: ['settlement_id']; referencedRelation: 'settlements'; referencedColumns: ['id'] }];
      };
      platform_config: { Row: PlatformConfig; Insert: InsertRow<PlatformConfig>; Update: UpdateRow<PlatformConfig>; Relationships: [] };
      cancellation_policies: { Row: CancellationPolicy; Insert: InsertRow<CancellationPolicy>; Update: UpdateRow<CancellationPolicy>; Relationships: [] };
      // --- Migration 007: Pharmacy ---
      medicines: { Row: Medicine; Insert: InsertRow<Medicine>; Update: UpdateRow<Medicine>; Relationships: [] };
      medicine_orders: {
        Row: MedicineOrder; Insert: InsertRow<MedicineOrder>; Update: UpdateRow<MedicineOrder>;
        Relationships: [{ foreignKeyName: 'medicine_orders_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      medicine_order_items: {
        Row: MedicineOrderItem; Insert: InsertRow<MedicineOrderItem>; Update: UpdateRow<MedicineOrderItem>;
        Relationships: [
          { foreignKeyName: 'medicine_order_items_order_id_fkey'; columns: ['order_id']; referencedRelation: 'medicine_orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'medicine_order_items_medicine_id_fkey'; columns: ['medicine_id']; referencedRelation: 'medicines'; referencedColumns: ['id'] }
        ];
      };
      delivery_tracking: {
        Row: DeliveryTracking; Insert: InsertRow<DeliveryTracking>; Update: UpdateRow<DeliveryTracking>;
        Relationships: [{ foreignKeyName: 'delivery_tracking_order_id_fkey'; columns: ['order_id']; referencedRelation: 'medicine_orders'; referencedColumns: ['id'] }];
      };
      medicine_returns: {
        Row: MedicineReturn; Insert: InsertRow<MedicineReturn>; Update: UpdateRow<MedicineReturn>;
        Relationships: [{ foreignKeyName: 'medicine_returns_order_id_fkey'; columns: ['order_id']; referencedRelation: 'medicine_orders'; referencedColumns: ['id'] }];
      };
      pharmacy_settlements: {
        Row: PharmacySettlement; Insert: InsertRow<PharmacySettlement>; Update: UpdateRow<PharmacySettlement>;
        Relationships: [{ foreignKeyName: 'pharmacy_settlements_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }];
      };
      // --- Migration 008: Notifications, Support & Audit ---
      notification_templates: { Row: NotificationTemplate; Insert: InsertRow<NotificationTemplate>; Update: UpdateRow<NotificationTemplate>; Relationships: [] };
      notifications: {
        Row: Notification; Insert: InsertRow<Notification>; Update: UpdateRow<Notification>;
        Relationships: [{ foreignKeyName: 'notifications_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      notification_preferences: {
        Row: NotificationPreference; Insert: InsertRow<NotificationPreference>; Update: UpdateRow<NotificationPreference>;
        Relationships: [{ foreignKeyName: 'notification_preferences_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      support_tickets: {
        Row: SupportTicket; Insert: InsertRow<SupportTicket>; Update: UpdateRow<SupportTicket>;
        Relationships: [{ foreignKeyName: 'support_tickets_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      ticket_messages: {
        Row: TicketMessage; Insert: InsertRow<TicketMessage>; Update: UpdateRow<TicketMessage>;
        Relationships: [{ foreignKeyName: 'ticket_messages_ticket_id_fkey'; columns: ['ticket_id']; referencedRelation: 'support_tickets'; referencedColumns: ['id'] }];
      };
      audit_logs: {
        Row: AuditLog; Insert: InsertRow<AuditLog>; Update: UpdateRow<AuditLog>;
        Relationships: [{ foreignKeyName: 'audit_logs_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      system_logs: { Row: SystemLog; Insert: InsertRow<SystemLog>; Update: UpdateRow<SystemLog>; Relationships: [] };
      api_keys: {
        Row: ApiKey; Insert: InsertRow<ApiKey>; Update: UpdateRow<ApiKey>;
        Relationships: [{ foreignKeyName: 'api_keys_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }];
      };
      scheduled_notifications: {
        Row: ScheduledNotification; Insert: InsertRow<ScheduledNotification>; Update: UpdateRow<ScheduledNotification>;
        Relationships: [{ foreignKeyName: 'scheduled_notifications_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      notification_queue: { Row: NotificationQueue; Insert: InsertRow<NotificationQueue>; Update: UpdateRow<NotificationQueue>; Relationships: [] };
      hospital_verification_requests: {
        Row: HospitalVerificationRequest; Insert: InsertRow<HospitalVerificationRequest>; Update: UpdateRow<HospitalVerificationRequest>;
        Relationships: [{ foreignKeyName: 'hospital_verification_requests_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }];
      };
      scheduled_reports: { Row: ScheduledReport; Insert: InsertRow<ScheduledReport>; Update: UpdateRow<ScheduledReport>; Relationships: [] };
      hospital_announcements: {
        Row: HospitalAnnouncement; Insert: InsertRow<HospitalAnnouncement>; Update: UpdateRow<HospitalAnnouncement>;
        Relationships: [{ foreignKeyName: 'hospital_announcements_hospital_id_fkey'; columns: ['hospital_id']; referencedRelation: 'hospitals'; referencedColumns: ['id'] }];
      };
      rating_helpfulness: {
        Row: RatingHelpfulness; Insert: InsertRow<RatingHelpfulness>; Update: UpdateRow<RatingHelpfulness>;
        Relationships: [{ foreignKeyName: 'rating_helpfulness_rating_id_fkey'; columns: ['rating_id']; referencedRelation: 'ratings'; referencedColumns: ['id'] }];
      };
      patient_credits: {
        Row: PatientCredit; Insert: InsertRow<PatientCredit>; Update: UpdateRow<PatientCredit>;
        Relationships: [{ foreignKeyName: 'patient_credits_user_id_fkey'; columns: ['user_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      credit_transactions: {
        Row: CreditTransaction; Insert: InsertRow<CreditTransaction>; Update: UpdateRow<CreditTransaction>;
        Relationships: [{ foreignKeyName: 'credit_transactions_credit_account_id_fkey'; columns: ['credit_account_id']; referencedRelation: 'patient_credits'; referencedColumns: ['id'] }];
      };
      patient_medications: {
        Row: PatientMedication; Insert: InsertRow<PatientMedication>; Update: UpdateRow<PatientMedication>;
        Relationships: [{ foreignKeyName: 'patient_medications_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      patient_allergies: {
        Row: PatientAllergy; Insert: InsertRow<PatientAllergy>; Update: UpdateRow<PatientAllergy>;
        Relationships: [{ foreignKeyName: 'patient_allergies_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
      patient_medical_conditions: {
        Row: PatientMedicalCondition; Insert: InsertRow<PatientMedicalCondition>; Update: UpdateRow<PatientMedicalCondition>;
        Relationships: [{ foreignKeyName: 'patient_medical_conditions_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'users'; referencedColumns: ['id'] }];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      gender: Gender;
      blood_group: BloodGroup;
      verification_status: VerificationStatus;
      otp_purpose: OTPPurpose;
      otp_channel: OTPChannel;
      family_relationship: RelationshipType;
      hospital_type: HospitalType;
      day_of_week: DayOfWeek;
      schedule_override_type: ScheduleOverrideType;
      consultation_type: ConsultationType;
      appointment_status: AppointmentStatus;
      consultation_status: ConsultationStatus;
      booking_source: BookingSource;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      payment_type: PaymentType;
      refund_status: RefundStatus;
      refund_reason: RefundReason;
      settlement_status: SettlementStatus;
      payout_status: PayoutStatus;
      payout_mode: PayoutMode;
      dispute_status: DisputeStatus;
      kyc_status: KycStatus;
      ledger_entry_type: LedgerEntryType;
      ledger_account_type: LedgerAccountType;
      reconciliation_status: ReconciliationStatus;
      webhook_processing_status: WebhookProcessingStatus;
      settlement_frequency: SettlementFrequency;
      medicine_category: MedicineCategory;
      medicine_schedule: MedicineSchedule;
      medicine_order_status: MedicineOrderStatus;
      delivery_partner_code: DeliveryPartnerCode;
      notification_type: NotificationType;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      ticket_status: TicketStatus;
      ticket_priority: TicketPriority;
      ticket_category: TicketCategory;
      document_type: DocumentType;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<string, never>;
  };
}

// =============================================================================
// TYPE HELPERS — for common query patterns
// =============================================================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
