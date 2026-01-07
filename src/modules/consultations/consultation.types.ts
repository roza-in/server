/**
 * Types for consultations module
 */

// Consultation status
export type ConsultationStatus = 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled';

// Consultation record
export interface Consultation {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  roomId: string | null;
  status: ConsultationStatus;
  scheduledDuration: number;
  actualDuration: number | null;
  startedAt: string | null;
  endedAt: string | null;
  doctorNotes: string | null;
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Consultation with details
export interface ConsultationWithDetails extends Consultation {
  appointment: {
    id: string;
    date: string;
    startTime: string;
    consultationType: string;
  };
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  patient: {
    id: string;
    name: string;
    phone: string;
  };
  prescription?: Prescription;
}

// Prescription
export interface Prescription {
  id: string;
  consultationId: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  diagnosis: string;
  chiefComplaints: string | null;
  clinicalNotes: string | null;
  medications: Medication[];
  labTests: string[] | null;
  advice: string | null;
  followUpDate: string | null;
  validUntil: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Medication in prescription
export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string; // Before/After meals
  instructions?: string;
}

// Start consultation input
export interface StartConsultationInput {
  appointmentId: string;
}

// End consultation input
export interface EndConsultationInput {
  consultationId: string;
  notes?: string;
}

// Create prescription input
export interface CreatePrescriptionInput {
  consultationId: string;
  appointmentId: string;
  diagnosis: string;
  chiefComplaints?: string;
  clinicalNotes?: string;
  medications: Medication[];
  labTests?: string[];
  advice?: string;
  followUpDate?: string;
  validUntil?: string;
}

// Video call token
export interface VideoCallToken {
  token: string;
  roomId: string;
  expiresAt: string;
}

// Consultation filters
export interface ConsultationFilters {
  doctorId?: string;
  patientId?: string;
  status?: ConsultationStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
