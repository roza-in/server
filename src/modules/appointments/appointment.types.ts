import type {
  Appointment,
  Consultation,
  Prescription,
  AppointmentStatus,
  ConsultationType,
  ConsultationStatus,
  PaymentStatus,
} from '../../types/database.types.js';

/**
 * Appointment Module Types - Extended from database schema
 */

// ============================================================================
// Appointment Extended Types
// ============================================================================

export interface AppointmentWithDetails extends Appointment {
  patient?: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
  };
  family_member?: {
    id: string;
    full_name: string;
    relationship: string;
    gender: string | null;
    date_of_birth: string | null;
  } | null;
  doctor?: {
    id: string;
    user_id: string;
    full_name: string | null;
    title: string;
    avatar_url: string | null;
    specialization_name: string | null;
  };
  hospital?: {
    id: string;
    name: string;
    slug: string;
    address: any;
    contact_phone: string | null;
  };
  consultation?: Consultation | null;
  prescription?: Prescription | null;
  payment?: {
    id: string;
    status: PaymentStatus;
    total_amount: number;
    paid_at: string | null;
  } | null;
}

export interface AppointmentListItem {
  id: string;
  booking_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  consultation_type: ConsultationType;
  status: AppointmentStatus;
  patient_name: string | null;
  patient_avatar: string | null;
  doctor_name: string | null;
  doctor_avatar: string | null;
  hospital_name: string | null;
  symptoms: string | null;
  payment_status?: PaymentStatus;
  total_amount?: number;
}

// ============================================================================
// Slot Types
// ============================================================================

export interface AppointmentSlot {
  id: string;
  doctor_id: string;
  hospital_id: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  consultation_type: ConsultationType;
  max_bookings: number;
  current_bookings: number;
  is_available: boolean;
  is_blocked: boolean;
  blocked_reason?: string;
}

export interface AvailableSlot {
  date: string;
  start_time: string;
  end_time: string;
  consultation_types: ConsultationType[];
  remaining_capacity: number;
  fee: number;
}

// ============================================================================
// Booking Types
// ============================================================================

export interface BookAppointmentInput {
  doctor_id: string;
  hospital_id?: string;
  family_member_id?: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  consultation_type: ConsultationType;
  symptoms?: string;
  patient_notes?: string;
}

export interface RescheduleInput {
  new_date: string;
  new_start_time: string;
  reason?: string;
}

export interface CancelInput {
  reason: string;
  cancelled_by: 'patient' | 'doctor' | 'hospital' | 'admin';
}

// ============================================================================
// Waitlist Types
// ============================================================================

export interface WaitlistEntry {
  id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string | null;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
  consultation_type: ConsultationType;
  status: 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled';
  notified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface JoinWaitlistInput {
  doctor_id: string;
  hospital_id?: string;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
  consultation_type: ConsultationType;
}

// ============================================================================
// Consultation Types
// ============================================================================

export interface ConsultationDetails extends Consultation {
  appointment?: Appointment;
  patient?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  doctor?: {
    id: string;
    full_name: string | null;
    title: string;
  };
}

export interface StartConsultationInput {
  appointment_id: string;
}

export interface EndConsultationInput {
  appointment_id: string;
  consultation_notes?: string;
  diagnosis?: string;
}

// ============================================================================
// Prescription Types
// ============================================================================

export interface PrescriptionDetails extends Prescription {
  medications_parsed: MedicationItem[];
  lab_tests_parsed: LabTest[];
}

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions?: string;
}

export interface LabTest {
  name: string;
  instructions?: string;
  urgent?: boolean;
}

export interface CreatePrescriptionInput {
  appointment_id: string;
  diagnosis?: string;
  medications: MedicationItem[];
  lab_tests?: LabTest[];
  radiology_tests?: string[];
  advice?: string;
  follow_up_date?: string;
  follow_up_instructions?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface AppointmentFilters {
  patient_id?: string;
  doctor_id?: string;
  hospital_id?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  consultation_type?: ConsultationType;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'date' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
}

export interface AppointmentListResponse {
  appointments: AppointmentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Stats Types
// ============================================================================

export interface AppointmentStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  today: number;
  upcoming: number;
}

// ============================================================================
// State Machine Types
// ============================================================================

export type AppointmentTransition = {
  from: AppointmentStatus;
  to: AppointmentStatus;
  action: string;
  allowed_roles: ('patient' | 'doctor' | 'hospital' | 'admin' | 'system')[];
};

export const APPOINTMENT_TRANSITIONS: AppointmentTransition[] = [
  { from: 'pending_payment', to: 'confirmed', action: 'payment_success', allowed_roles: ['system'] },
  { from: 'pending_payment', to: 'cancelled', action: 'payment_failed', allowed_roles: ['system'] },
  { from: 'pending_payment', to: 'cancelled', action: 'cancel', allowed_roles: ['patient', 'admin'] },
  { from: 'confirmed', to: 'checked_in', action: 'check_in', allowed_roles: ['patient', 'doctor', 'hospital'] },
  { from: 'confirmed', to: 'cancelled', action: 'cancel', allowed_roles: ['patient', 'doctor', 'hospital', 'admin'] },
  { from: 'confirmed', to: 'rescheduled', action: 'reschedule', allowed_roles: ['patient', 'doctor', 'hospital'] },
  { from: 'confirmed', to: 'no_show', action: 'mark_no_show', allowed_roles: ['doctor', 'hospital', 'admin'] },
  { from: 'checked_in', to: 'in_progress', action: 'start_consultation', allowed_roles: ['doctor'] },
  { from: 'checked_in', to: 'cancelled', action: 'cancel', allowed_roles: ['doctor', 'hospital', 'admin'] },
  { from: 'in_progress', to: 'completed', action: 'end_consultation', allowed_roles: ['doctor'] },
  { from: 'rescheduled', to: 'confirmed', action: 'confirm_reschedule', allowed_roles: ['patient'] },
  { from: 'rescheduled', to: 'cancelled', action: 'cancel', allowed_roles: ['patient', 'doctor', 'hospital', 'admin'] },
];
