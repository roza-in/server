import type {
  Hospital,
  HospitalType,
  SubscriptionTier,
  VerificationStatus,
  Doctor,
  Specialization,
} from '../../types/database.types.js';

/**
 * Hospital Module Types - Extended from database schema
 *
 * DB Table: hospitals (migration 003)
 * Key columns: type (hospital_type enum), phone, email, website, facilities (TEXT[]),
 *   logo_url, banner_url, photos, working_hours (JSONB), emergency_services (BOOLEAN),
 *   accepted_insurance (TEXT[]), founding_year, platform_commission_percent,
 *   medicine_commission_percent, verification_status (verification_status enum),
 *   latitude, longitude, location (JSONB)
 *
 * NOT in DB: subscription_tier, bank details columns, is_verified, license_number,
 *   emergency_24x7, contact_phone, contact_email, website_url, amenities,
 *   cover_image_url, specializations column, total_beds, operating_hours
 */

// ============================================================================
// Hospital Extended Types
// ============================================================================

export type HospitalRow = Hospital;

export interface HospitalProfile extends HospitalRow {
  doctors?: Doctor[];
  specializationDetails?: Specialization[];
  activeAppointmentsCount?: number;
  pendingVerification?: boolean;
}

export interface HospitalListItem {
  id: string;
  name: string;
  slug: string | null;
  type: HospitalType;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  banner_url: string | null;
  verification_status: VerificationStatus;
  rating: number;
  total_ratings: number;
  total_appointments: number;
  emergency_services: boolean;
  is_active: boolean;
}

export interface HospitalWithDoctors extends Hospital {
  doctors: DoctorListItem[];
  totalDoctors: number;
  availableDoctorsToday: number;
}

export interface DoctorListItem {
  id: string;
  name: string;
  specialization_id: string;
  specialization_name?: string;
  qualifications: string[] | null;
  experience_years: number;
  avatar_url: string | null;
  rating: number;
  total_ratings: number;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  online_consultation_enabled: boolean;
  walk_in_enabled: boolean;
  is_active: boolean;
  next_available_slot?: string;
}

// ============================================================================
// Hospital Stats & Analytics
// ============================================================================

export interface HospitalStats {
  totalDoctors: number;
  activeDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  todayAppointments: number;
  activeAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingSettlement: number;
  averageRating: number;
  totalReviews: number;
}

export interface HospitalDashboard {
  hospital: HospitalProfile;
  stats: HospitalStats;
  recentAppointments: RecentAppointment[];
  topDoctors: TopDoctor[];
  revenueChart: RevenueDataPoint[];
  upcomingSettlement: UpcomingSettlement | null;
}

export interface RecentAppointment {
  id: string;
  appointment_number: string;
  patient_name: string;
  doctor_name: string;
  scheduled_date: string;
  scheduled_start: string;
  consultation_type: string;
  status: string;
  payment_status: string;
}

export interface TopDoctor {
  id: string;
  name: string;
  specialization: string;
  total_consultations: number;
  rating: number | null;
  total_ratings: number;
  revenue_generated: number;
}

// ============================================================================
// Hospital Operation Types
// ============================================================================

export interface HospitalPatient {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  avatar_url: string | null;
  last_visit: string | null;
  total_appointments: number;
  gender: string | null;
  date_of_birth: string | null;
}

export interface HospitalAppointment extends RecentAppointment {
  patient_phone: string;
  consultation_fee: number;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// Hospital Billing & Payment Types
// ============================================================================

export interface HospitalPayment {
  id: string;
  appointment_id: string;
  patient_name: string;
  amount: number;
  platform_fee: number;
  hospital_payout: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  paid_at: string | null;
}

export interface HospitalInvoice {
  id: string;
  invoice_number: string;
  appointment_id: string | null;
  patient_name: string;
  amount: number;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  due_date: string | null;
  issued_at: string;
}

export interface HospitalSettlementInfo {
  id: string;
  period_start: string;
  period_end: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  settled_at: string | null;
  transaction_id: string | null;
}

export interface RevenueDataPoint {
  date: string;
  gross_revenue: number;
  platform_fees: number;
  net_revenue: number;
  consultations_count: number;
}

export interface UpcomingSettlement {
  id: string;
  period_start: string;
  period_end: string;
  total_consultations: number;
  gross_revenue: number;
  platform_fees: number;
  net_payout: number;
  estimated_payout_date: string;
}

// ============================================================================
// Filter & Search Types
// ============================================================================

export interface HospitalFilters {
  search?: string;
  city?: string;
  state?: string;
  type?: HospitalType;
  specialization_id?: string;
  verification_status?: VerificationStatus;
  emergency_services?: boolean;
  min_rating?: number;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'rating' | 'total_appointments' | 'created_at' | 'distance';
  sort_order?: 'asc' | 'desc';
}

export interface HospitalListResponse {
  hospitals: HospitalListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Update/Create Types
// ============================================================================

export interface CreateHospitalInput {
  admin_user_id: string;
  name: string;
  type: HospitalType;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  registration_number?: string;
  founding_year?: number;
  phone: string;
  email?: string;
  website?: string;
  address?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  facilities?: string[];
  accepted_insurance?: string[];
  languages_spoken?: string[];
  working_hours?: OperatingHours;
  emergency_services?: boolean;
}

// UpdateHospitalInput — canonical type inferred from validator schema (hospital.validator.ts)
// UpdatePaymentSettingsInput — canonical type inferred from validator schema (hospital.validator.ts)

export interface HospitalAddress {
  address?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  is_open: boolean;
  open_time?: string;
  close_time?: string;
  breaks?: TimeBreak[];
}

export interface TimeBreak {
  start_time: string;
  end_time: string;
}

// ============================================================================
// Verification Types
// ============================================================================

// VerifyHospitalInput — canonical type inferred from validator schema (hospital.validator.ts)

export interface HospitalVerificationDetails {
  id: string;
  name: string;
  registration_number: string | null;
  accreditations: string[] | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  verified_at: string | null;
  documents: VerificationDocument[];
  admin_details: {
    name: string | null;
    email: string | null;
    phone: string;
  };
}

export interface VerificationDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface UpdateSubscriptionInput {
  subscription_tier: SubscriptionTier;
  subscription_starts_at: string;
  subscription_ends_at: string;
}

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  days_remaining: number | null;
  features: SubscriptionFeature[];
}

export interface SubscriptionFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

