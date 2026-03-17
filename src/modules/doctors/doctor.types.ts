import type {
  Doctor,
  DoctorSchedule,
  ScheduleOverride,
  ConsultationType,
  DayOfWeek,
  VerificationStatus,
  Specialization,
  ScheduleOverrideType,
} from '../../types/database.types.js';

/**
 * Doctor Module Types - Extended from database schema
 */

// ============================================================================
// Doctor Extended Types
// ============================================================================

export type DoctorRow = Doctor;

export interface DoctorProfile extends Doctor {
  user?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  hospital?: {
    id: string;
    name: string;
    slug: string | null;
    type: string;
    address: string | null;
  };
  specialization?: Specialization;
  schedules?: DoctorSchedule[];
}

export interface DoctorListItem {
  id: string;
  user_id: string;
  hospital_id: string;
  name: string | null;
  avatar_url: string | null;
  specialization_id: string;
  specialization_name?: string;
  qualifications: string[] | null;
  experience_years: number;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  online_consultation_enabled: boolean;
  walk_in_enabled: boolean;
  consultation_types: ConsultationType[];
  rating: number;
  total_ratings: number;
  total_consultations: number;
  verification_status: VerificationStatus;
  is_active: boolean;
  hospital_name?: string;
  hospital_city?: string;
  next_available_slot?: string;
}

export interface DoctorPublicProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  specialization: Specialization | null;
  qualifications: string[] | null;
  experience_years: number;
  bio: string | null;
  languages: string[];
  registration_number: string;
  registration_council: string | null;
  registration_year: number | null;
  awards: string[] | null;
  publications: string[] | null;
  certifications: string[] | null;
  memberships: string[] | null;
  available_service: string[] | null;
  social_profiles: any;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  consultation_fee_walk_in: number;
  follow_up_fee: number;
  slot_duration_minutes: number;
  online_consultation_enabled: boolean;
  walk_in_enabled: boolean;
  consultation_types: ConsultationType[];
  rating: number;
  total_ratings: number;
  hospital: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    address: string | null;
  } | null;
  availability: DoctorDayAvailability[];
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface DoctorDayAvailability {
  date: string;
  day_of_week: DayOfWeek;
  is_available: boolean;
  slots: TimeSlot[];
  override?: ScheduleOverride;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  consultation_types: ConsultationType[];
  is_available: boolean;
  is_booked: boolean;
  remaining_capacity: number;
  max_capacity: number;
}

export interface ScheduleInput {
  day_of_week: DayOfWeek;
  consultation_type: ConsultationType;
  start_time: string;
  end_time: string;
  slot_duration_minutes?: number;
  break_start?: string | null;
  break_end?: string | null;
  max_patients_per_slot?: number;
  is_active?: boolean;
}

export interface ScheduleOverrideInput {
  override_date: string;
  override_type: ScheduleOverrideType;
  reason?: string;
  start_time?: string | null;
  end_time?: string | null;
}

// ============================================================================
// Filter & Search Types
// ============================================================================

export interface DoctorFilters {
  search?: string;
  hospital_id?: string;
  specialization_id?: string;
  city?: string;
  state?: string;
  consultation_type?: ConsultationType;
  verification_status?: VerificationStatus;
  min_experience?: number;
  max_fee?: number;
  min_rating?: number;
  available_today?: boolean;
  language?: string;
  gender?: string;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'experience' | 'fee' | 'rating' | 'consultations';
  sort_order?: 'asc' | 'desc';
  include_unverified?: boolean;
}

export interface DoctorListResponse {
  doctors: DoctorListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Stats Types
// ============================================================================

export interface DoctorStats {
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  todayAppointments: number;
  upcomingAppointments: number;
  totalEarnings: number;
  monthlyEarnings: number;
  pendingPayouts: number;
  rating: number;
  totalRatings: number;
  averageConsultationTime: number;
}

export interface DoctorDashboard {
  doctor: DoctorProfile;
  stats: DoctorStats;
  todaySchedule: DoctorDayAvailability;
  upcomingAppointments: UpcomingAppointment[];
  recentPatients: RecentPatient[];
}

export interface UpcomingAppointment {
  id: string;
  appointment_number: string;
  patient_name: string;
  patient_avatar: string | null;
  scheduled_date: string;
  scheduled_start: string;
  consultation_type: ConsultationType;
  status: string;
  patient_notes?: string;
}

export interface RecentPatient {
  id: string;
  name: string;
  avatar_url: string | null;
  last_visit: string;
  total_visits: number;
}

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateDoctorInput {
  specialization_id?: string;
  qualifications?: string[];
  experience_years?: number;
  bio?: string;
  languages?: string[];
  consultation_fee_online?: number;
  consultation_fee_in_person?: number;
  consultation_fee_walk_in?: number;
  follow_up_fee?: number;
  follow_up_validity_days?: number;
  slot_duration_minutes?: number;
  buffer_time_minutes?: number;
  max_patients_per_slot?: number;
  online_consultation_enabled?: boolean;
  walk_in_enabled?: boolean;
  consultation_types?: ConsultationType[];
  is_available?: boolean;
  registration_number?: string;
  registration_council?: string;
}

export interface UpdateDoctorVerificationInput {
  verification_status: VerificationStatus;
  rejection_reason?: string;
}

