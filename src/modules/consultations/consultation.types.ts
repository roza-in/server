import type {
  Consultation,
  Prescription,
  ConsultationStatus,
  ConsultationType,
} from '../../types/database.types.js';

/**
 * Types for consultations module
 * All base types imported from database.types.ts
 */

// Re-export for convenience
export type { ConsultationStatus };

// ============================================================================
// Consultation Extended Types
// ============================================================================

// Consultation with joined relations
export interface ConsultationWithDetails extends Consultation {
  appointment?: {
    id: string;
    scheduled_date: string;
    scheduled_start: string;
    consultation_type: ConsultationType;
    patient_id: string;
    doctor_id: string;
    hospital_id: string;
    patient?: {
      id: string;
      name: string | null;
      phone: string;
      email?: string | null;
      avatar_url?: string | null;
    };
    doctor?: {
      id: string;
      user_id: string;
      users?: {
        name: string | null;
        avatar_url?: string | null;
      };
      specializations?: {
        name: string;
      } | null;
    };
  };
  doctor?: {
    id: string;
    user_id: string;
    users?: {
      name: string | null;
      avatar_url?: string | null;
    };
    specializations?: {
      name: string;
    } | null;
  };
  patient?: {
    id: string;
    name: string | null;
    phone: string;
  };
  prescriptions?: Prescription[];
}

// Flattened consultation for API responses
export interface ConsultationResponse {
  id: string;
  appointmentId: string;
  status: ConsultationStatus;
  roomId: string | null;
  roomUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  chiefComplaint: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  vitals: any | null;
  followUpRequired: boolean;
  followUpNotes: string | null;
  followUpDays: number | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  appointment?: {
    id: string;
    date: string;
    startTime: string;
    consultationType: string;
  };
  doctor?: {
    id: string;
    name: string;
    specialization: string;
  };
  patient?: {
    id: string;
    name: string;
    phone: string;
  };
  prescription?: Prescription;
}

// ============================================================================
// Prescription Types (re-exported from DB, with parsed helpers)
// ============================================================================

// Medication in prescription (JSON structure)
export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string; // Before/After meals
  instructions?: string;
}

// ============================================================================
// Video & Filter Types
// ============================================================================

// Video call token
export interface VideoCallToken {
  token: string;
  roomId: string;
  expiresAt: string;
  appId?: string;
  uid?: number;
  channelName?: string;
  provider: 'agora' | 'zegocloud';
}

// Consultation filters
export interface ConsultationFilters {
  doctor_id?: string;
  patient_id?: string;
  appointment_id?: string;
  status?: ConsultationStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

