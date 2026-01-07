import type {
  Doctor,
  DoctorSchedule,
  ScheduleOverride,
  ConsultationType,
  DayOfWeek,
  VerificationStatus,
  Specialization,
} from '../../types/database.types.js';

/**
 * Doctor Module Types - Extended from database schema
 */

// ============================================================================
// Doctor Extended Types
// ============================================================================

export interface DoctorProfile extends Doctor {
  user?: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    avatar_url: string | null;
  };
  hospital?: {
    id: string;
    name: string;
    slug: string;
    hospital_type: string;
    address: any;
  };
  specialization?: Specialization;
  schedules?: DoctorSchedule[];
}

export interface DoctorListItem {
  id: string;
  user_id: string;
  hospital_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  title: string;
  specialization_id: string | null;
  specialization_name?: string;
  qualifications: any;
  experience_years: number;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  accepts_online: boolean;
  accepts_in_person: boolean;
  accepts_walk_in: boolean;
  rating: number | null;
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
  title: string;
  full_name: string;
  avatar_url: string | null;
  specialization: Specialization | null;
  qualifications: any;
  experience_years: number;
  bio: string | null;
  languages_spoken: string[] | null;
  consultation_fee_online: number;
  consultation_fee_in_person: number;
  consultation_fee_walk_in: number | null;
  consultation_duration: number;
  accepts_online: boolean;
  accepts_in_person: boolean;
  accepts_walk_in: boolean;
  rating: number | null;
  total_ratings: number;
  hospital: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    address: any;
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
  id?: string;
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
  start_time: string;
  end_time: string;
  slot_duration?: number;
  buffer_time?: number;
  break_start?: string;
  break_end?: string;
  max_patients_per_slot?: number;
  consultation_types?: ConsultationType[];
  is_active?: boolean;
}

export interface ScheduleOverrideInput {
  override_date: string;
  is_available: boolean;
  reason?: string;
  custom_start_time?: string;
  custom_end_time?: string;
  custom_slot_duration?: number;
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
  accepts_online?: boolean;
  accepts_in_person?: boolean;
  accepts_walk_in?: boolean;
  language?: string;
  gender?: string;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'experience' | 'fee' | 'rating' | 'consultations';
  sort_order?: 'asc' | 'desc';
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
  rating: number | null;
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
  booking_id: string;
  patient_name: string;
  patient_avatar: string | null;
  appointment_date: string;
  start_time: string;
  consultation_type: ConsultationType;
  status: string;
  symptoms?: string;
}

export interface RecentPatient {
  id: string;
  full_name: string;
  avatar_url: string | null;
  last_visit: string;
  total_visits: number;
}

// ============================================================================
// Update Types
// ============================================================================

export interface UpdateDoctorInput {
  title?: string;
  specialization_id?: string;
  qualifications?: any;
  experience_years?: number;
  bio?: string;
  languages_spoken?: string[];
  consultation_fee_online?: number;
  consultation_fee_in_person?: number;
  consultation_fee_walk_in?: number;
  consultation_duration?: number;
  accepts_online?: boolean;
  accepts_in_person?: boolean;
  accepts_walk_in?: boolean;
  max_appointments_per_day?: number;
  signature_url?: string;
  stamp_url?: string;
}

export interface UpdateDoctorVerificationInput {
  verification_status: VerificationStatus;
  verification_notes?: string;
  verification_documents?: any;
}
