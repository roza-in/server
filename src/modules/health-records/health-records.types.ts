import type {
  FamilyMember as DBFamilyMember,
  HealthDocument as DBHealthDocument,
  PatientVital,
  MedicationReminder as DBMedicationReminder,
  MedicationLog,
  PatientMedication,
  PatientAllergy,
  PatientMedicalCondition,
  Gender,
  BloodGroup,
  RelationshipType,
  DocumentType,
} from '../../types/database.types.js';

/**
 * Health Records Module Types — aligned with database schema
 */

// ============================================================================
// Family Member Types
// ============================================================================

export type FamilyMember = DBFamilyMember;

export interface FamilyMemberWithHealth extends FamilyMember {
  latest_vitals?: PatientVital | null;
  active_medications?: PatientMedication[];
  upcoming_reminders?: DBMedicationReminder[];
  recent_documents?: DBHealthDocument[];
}

export interface CreateFamilyMemberInput {
  name: string;
  relationship: RelationshipType;
  gender?: Gender;
  date_of_birth?: string;
  blood_group?: BloodGroup;
  medical_conditions?: string[];
  allergies?: string[];
}

export interface UpdateFamilyMemberInput {
  name?: string;
  relationship?: RelationshipType;
  gender?: Gender | null;
  date_of_birth?: string | null;
  blood_group?: BloodGroup | null;
  medical_conditions?: string[] | null;
  allergies?: string[] | null;
  is_active?: boolean;
}

// ============================================================================
// Health Document Types
// ============================================================================

export type HealthDocument = DBHealthDocument;

export interface DocumentWithDetails extends DBHealthDocument {
  family_member?: {
    id: string;
    name: string;
  } | null;
  appointment?: {
    id: string;
    appointment_number: string;
    scheduled_date: string;
    doctor_name: string | null;
  } | null;
}

export interface UploadDocumentInput {
  family_member_id?: string;
  appointment_id?: string;
  consultation_id?: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  document_date?: string;
  hospital_name?: string;
  doctor_name?: string;
  is_shared?: boolean;
  shared_doctors?: string[];
}

export interface UpdateDocumentInput {
  document_type?: DocumentType;
  title?: string;
  description?: string | null;
  document_date?: string | null;
  is_shared?: boolean;
  shared_doctors?: string[] | null;
}

export interface DocumentFilters {
  patient_id?: string;
  family_member_id?: string;
  appointment_id?: string;
  consultation_id?: string;
  document_type?: DocumentType | DocumentType[];
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListDocumentsInput {
  family_member_id?: string;
  appointment_id?: string;
  document_type?: DocumentType;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Vital Records Types (maps to patient_vitals table)
// ============================================================================

export type VitalRecord = PatientVital;

export interface CreateVitalRecordInput {
  family_member_id?: string;
  consultation_id?: string;
  recorded_at?: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse_rate?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  blood_sugar_fasting?: number;
  blood_sugar_pp?: number;
  notes?: string;
  recorded_by?: string;
}

export interface VitalFilters {
  patient_id?: string;
  family_member_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface ListVitalsInput {
  family_member_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface VitalTrends {
  period: string;
  avg_systolic: number | null;
  avg_diastolic: number | null;
  avg_pulse_rate: number | null;
  avg_weight: number | null;
  avg_blood_sugar_fasting: number | null;
  records_count: number;
}

// ============================================================================
// Medication Types (maps to patient_medications table)
// ============================================================================

export type Medication = PatientMedication;

export interface CreateMedicationInput {
  family_member_id?: string;
  prescription_id?: string;
  medication_name: string;
  generic_name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  start_date: string;
  end_date?: string;
  reason?: string;
  notes?: string;
  prescribed_by?: string;
}

export interface UpdateMedicationInput {
  medication_name?: string;
  generic_name?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  end_date?: string | null;
  reason?: string;
  notes?: string | null;
  is_active?: boolean;
}

export interface MedicationFilters {
  patient_id?: string;
  family_member_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface ListMedicationsInput {
  family_member_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================================
// Medication Reminder Types (maps to medication_reminders table)
// ============================================================================

export type MedicationReminder = DBMedicationReminder;

export interface CreateMedicationReminderInput {
  family_member_id?: string;
  prescription_id?: string;
  medicine_id?: string;
  medicine_name: string;
  dosage?: string;
  instructions?: string;
  frequency: string;
  reminder_times: string[];
  meal_timing?: string;
  start_date: string;
  end_date?: string;
  push_enabled?: boolean;
  sms_enabled?: boolean;
}

export interface UpdateMedicationReminderInput {
  medicine_name?: string;
  dosage?: string;
  instructions?: string;
  frequency?: string;
  reminder_times?: string[];
  meal_timing?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  push_enabled?: boolean;
  sms_enabled?: boolean;
}

// ============================================================================
// Medication Log Types (maps to medication_logs table)
// ============================================================================

export type MedicationLogRecord = MedicationLog;

export interface RecordMedicationActionInput {
  action: 'taken' | 'skipped' | 'missed';
  scheduled_time: string;
  taken_at?: string;
  skipped_reason?: string;
  notes?: string;
}

// ============================================================================
// Allergy Types (maps to patient_allergies table)
// ============================================================================

export type Allergy = PatientAllergy;

export type AllergyType = 'drug' | 'food' | 'environmental' | 'insect' | 'latex' | 'other';
export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'life_threatening';

export interface CreateAllergyInput {
  family_member_id?: string;
  allergen: string;
  allergen_type: AllergyType;
  severity: AllergySeverity;
  reaction?: string;
  onset_date?: string;
  diagnosed_by?: string;
}

export interface UpdateAllergyInput {
  allergen?: string;
  allergen_type?: AllergyType;
  severity?: AllergySeverity;
  reaction?: string | null;
  onset_date?: string | null;
  diagnosed_by?: string | null;
  is_active?: boolean;
}

export interface ListAllergiesInput {
  family_member_id?: string;
  allergen_type?: AllergyType;
  page?: number;
  limit?: number;
}

// ============================================================================
// Medical Condition Types (maps to patient_medical_conditions)
// ============================================================================

export type MedicalCondition = PatientMedicalCondition;

export type ConditionSeverity = 'mild' | 'moderate' | 'severe' | 'critical';
export type ConditionStatus = 'active' | 'resolved' | 'chronic' | 'in_remission';

// ============================================================================
// Health Summary Types
// ============================================================================

export interface HealthSummary {
  user: {
    id: string;
    name: string;
    date_of_birth: string | null;
    blood_group: string | null;
  };
  family_members: FamilyMember[];
  latest_vitals: VitalRecord | null;
  active_medications: Medication[];
  allergies: Allergy[];
  chronic_conditions: MedicalCondition[];
  recent_documents: HealthDocument[];
  upcoming_reminders: MedicationReminder[];
}

export interface FamilyHealthSummary {
  member: FamilyMemberWithHealth;
  latest_vitals: VitalRecord | null;
  active_medications: Medication[];
  allergies: Allergy[];
  conditions: MedicalCondition[];
  upcoming_reminders: MedicationReminder[];
}

