// ============================================================================
// Prescription Module Types
// ============================================================================

export interface Prescription {
    id: string;
    prescription_number: string;
    appointment_id: string;
    consultation_id: string | null;
    doctor_id: string;
    patient_id: string;
    hospital_id: string | null;
    chief_complaints: string | null;
    diagnosis: string;
    diagnosis_icd_codes: string[] | null;
    vitals: PrescriptionVitals | null;
    medications: Medication[];
    lab_tests: LabTest[] | null;
    investigations: Investigation[] | null;
    lifestyle_advice: string[] | null;
    dietary_advice: string[] | null;
    general_advice: string | null;
    precautions: string | null;
    follow_up_date: string | null;
    follow_up_instructions: string | null;
    valid_until: string | null;
    pdf_url: string | null;
    signed_at: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PrescriptionVitals {
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse?: number;
    temp?: number;
    weight?: number;
    height?: number;
    spo2?: number;
}

export interface Medication {
    name: string;
    generic_name?: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
    meal_relation?: 'before' | 'after' | 'with' | 'any';
    route?: string;
    quantity?: number;
}

export interface LabTest {
    name: string;
    instructions?: string;
    urgency?: 'routine' | 'urgent' | 'stat';
}

export interface Investigation {
    type: string;
    name: string;
    instructions?: string;
}

export interface PrescriptionListItem {
    id: string;
    prescription_number: string;
    diagnosis: string;
    doctor_name: string;
    hospital_name: string | null;
    created_at: string;
}

export interface CreatePrescriptionInput {
    appointment_id: string;
    consultation_id?: string;
    chief_complaints?: string;
    diagnosis: string;
    diagnosis_icd_codes?: string[];
    vitals?: PrescriptionVitals;
    medications: Medication[];
    lab_tests?: LabTest[];
    investigations?: Investigation[];
    lifestyle_advice?: string[];
    dietary_advice?: string[];
    general_advice?: string;
    precautions?: string;
    follow_up_date?: string;
    follow_up_instructions?: string;
}

export interface PrescriptionFilters {
    patientId?: string;
    doctorId?: string;
    hospitalId?: string;
    page?: number;
    limit?: number;
}

