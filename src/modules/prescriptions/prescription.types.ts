import type { Prescription } from '../../types/database.types.js';

// ============================================================================
// Prescription Module Types — aligned with DB schema (004_appointments_consultations.sql)
// ============================================================================

// Re-export the canonical DB type
export type { Prescription };

/**
 * Medication JSONB shape stored in prescriptions.medications
 */
export interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    timing?: string;
    instructions?: string;
}

export interface PrescriptionWithRelations extends Prescription {
    doctor?: {
        id: string;
        specialization: string | null;
        registration_number: string | null;
        users?: { name: string | null } | null;
    } | null;
    patient?: {
        id: string;
        name: string | null;
    } | null;
    consultation?: {
        id: string;
        appointment?: Record<string, unknown> | null;
    } | null;
    hospital?: {
        id: string;
        name: string;
        slug?: string;
        address_line1?: string;
        city?: string;
        phone?: string;
    } | null;

    // Flattened fields for frontend consistency
    patientName?: string;
    doctorName?: string;
    doctorSpecialization?: string;
    doctorRegistrationNumber?: string;
    hospitalName?: string;
}

export interface PrescriptionListItem {
    id: string;
    prescription_number: string | null;
    diagnosis: string[] | null;
    doctor_name: string | null;
    hospital_name: string | null;
    created_at: string;
}

export interface CreatePrescriptionInput {
    consultation_id: string;
    diagnosis?: string[];
    medications: Medication[];
    lab_tests?: string[];
    imaging_tests?: string[];
    diet_advice?: string;
    lifestyle_advice?: string;
    general_instructions?: string;
    valid_until?: string;
}

export interface PrescriptionFilters {
    patient_id?: string;
    doctor_id?: string;
    hospital_id?: string;
    page?: number;
    limit?: number;
}
