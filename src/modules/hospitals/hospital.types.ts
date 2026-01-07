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
 */

// ============================================================================
// Hospital Extended Types
// ============================================================================

export interface HospitalProfile extends Hospital {
  doctors?: Doctor[];
  specializations?: Specialization[];
  activeAppointmentsCount?: number;
  pendingVerification?: boolean;
}

export interface HospitalListItem {
  id: string;
  name: string;
  slug: string;
  hospital_type: HospitalType;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  specializations: string[] | null;
  subscription_tier: SubscriptionTier;
  verification_status: VerificationStatus;
  rating: number | null;
  total_ratings: number;
  total_consultations: number;
  emergency_24x7: boolean;
  is_active: boolean;
}

export interface HospitalWithDoctors extends Hospital {
  doctors: DoctorListItem[];
  totalDoctors: number;
  availableDoctorsToday: number;
}

export interface DoctorListItem {
  id: string;
  full_name: string;
  title: string;
  specialization_id: string | null;
  specialization_name?: string;
  qualifications: any;
  experience_years: number;
  avatar_url: string | null;
  rating: number | null;
  total_ratings: number;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  accepts_online: boolean;
  accepts_in_person: boolean;
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
  upcomingAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingSettlements: number;
  platformFeesOwed: number;
  rating: number | null;
  totalRatings: number;
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
  booking_id: string;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  start_time: string;
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
  hospital_type?: HospitalType;
  specialization_id?: string;
  subscription_tier?: SubscriptionTier;
  verification_status?: VerificationStatus;
  emergency_24x7?: boolean;
  min_rating?: number;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'rating' | 'total_consultations' | 'created_at' | 'distance';
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
  hospital_type: HospitalType;
  tagline?: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  registration_number?: string;
  license_number?: string;
  established_year?: number;
  address: HospitalAddress;
  contact_phone?: string;
  contact_email?: string;
  website_url?: string;
  emergency_phone?: string;
  facilities?: string[];
  specializations?: string[];
  insurance_accepted?: string[];
  languages_spoken?: string[];
  operating_hours?: OperatingHours;
  emergency_24x7?: boolean;
  pharmacy_24x7?: boolean;
  lab_24x7?: boolean;
  ambulance_service?: boolean;
  parking_available?: boolean;
  cafeteria_available?: boolean;
}

export interface UpdateHospitalInput {
  name?: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  gallery_urls?: string[];
  registration_number?: string;
  license_number?: string;
  accreditations?: string[];
  established_year?: number;
  total_beds?: number;
  icu_beds?: number;
  operating_theaters?: number;
  address?: HospitalAddress;
  contact_phone?: string;
  contact_email?: string;
  website_url?: string;
  emergency_phone?: string;
  facilities?: string[];
  specializations?: string[];
  insurance_accepted?: string[];
  languages_spoken?: string[];
  operating_hours?: OperatingHours;
  emergency_24x7?: boolean;
  pharmacy_24x7?: boolean;
  lab_24x7?: boolean;
  ambulance_service?: boolean;
  parking_available?: boolean;
  cafeteria_available?: boolean;
  payment_gateway_enabled?: boolean;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
  gstin?: string;
  pan?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
}

export interface UpdatePaymentSettingsInput {
  payment_gateway_enabled: boolean;
  platform_fee_online?: number;
  platform_fee_in_person?: number;
  platform_fee_walk_in?: number;
  auto_settlement?: boolean;
  settlement_frequency?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
  gstin?: string;
  pan?: string;
}

export interface HospitalAddress {
  line1?: string;
  line2?: string;
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

export interface VerifyHospitalInput {
  hospital_id: string;
  verification_status: 'verified' | 'rejected';
  verification_notes?: string;
  verified_by: string;
}

export interface HospitalVerificationDetails {
  id: string;
  name: string;
  registration_number: string | null;
  license_number: string | null;
  accreditations: string[] | null;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  documents: VerificationDocument[];
  admin_details: {
    full_name: string | null;
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
