import type {
  Gender,
  BloodGroup,
  RelationshipType,
  DocumentType,
} from '../../types/database.types.js';

/**
 * Health Records Module Types
 */

// ============================================================================
// Family Member Types
// ============================================================================

export interface FamilyMember {
  id: string;
  user_id: string;
  full_name: string;
  relationship: RelationshipType;
  gender: Gender | null;
  date_of_birth: string | null;
  blood_group: BloodGroup | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  emergency_contact: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberWithHealth extends FamilyMember {
  latest_vitals?: VitalRecord | null;
  active_medications?: Medication[];
  upcoming_reminders?: MedicationReminder[];
  recent_documents?: HealthDocument[];
}

export interface CreateFamilyMemberInput {
  full_name: string;
  relationship: RelationshipType;
  gender?: Gender;
  date_of_birth?: string;
  blood_group?: BloodGroup;
  phone?: string;
  email?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact?: boolean;
}

export interface UpdateFamilyMemberInput {
  full_name?: string;
  relationship?: RelationshipType;
  gender?: Gender;
  date_of_birth?: string;
  blood_group?: BloodGroup;
  phone?: string;
  email?: string;
  avatar_url?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact?: boolean;
}

// ============================================================================
// Health Document Types
// ============================================================================

export interface HealthDocument {
  id: string;
  user_id: string;
  family_member_id: string | null;
  appointment_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  tags: string[] | null;
  metadata: Record<string, any> | null;
  is_shared_with_doctors: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentWithDetails extends HealthDocument {
  family_member?: {
    id: string;
    full_name: string;
  } | null;
  appointment?: {
    id: string;
    booking_id: string;
    appointment_date: string;
    doctor_name: string | null;
  } | null;
}

export interface UploadDocumentInput {
  family_member_id?: string;
  appointment_id?: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  tags?: string[];
  is_shared_with_doctors?: boolean;
}

export interface UpdateDocumentInput {
  document_type?: DocumentType;
  title?: string;
  description?: string;
  tags?: string[];
  is_shared_with_doctors?: boolean;
}

export interface DocumentFilters {
  user_id?: string;
  family_member_id?: string;
  appointment_id?: string;
  document_type?: DocumentType | DocumentType[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Vital Records Types
// ============================================================================

export interface VitalRecord {
  id: string;
  user_id: string;
  family_member_id: string | null;
  recorded_at: string;
  // Basic vitals
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  temperature_unit: 'celsius' | 'fahrenheit';
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  // Body measurements
  weight: number | null;
  weight_unit: 'kg' | 'lb';
  height: number | null;
  height_unit: 'cm' | 'ft';
  bmi: number | null;
  // Blood sugar
  blood_sugar: number | null;
  blood_sugar_type: 'fasting' | 'random' | 'post_meal' | null;
  // Additional
  notes: string | null;
  source: 'manual' | 'device' | 'clinic';
  device_id: string | null;
  created_at: string;
}

export interface CreateVitalRecordInput {
  family_member_id?: string;
  recorded_at?: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  temperature_unit?: 'celsius' | 'fahrenheit';
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  weight_unit?: 'kg' | 'lb';
  height?: number;
  height_unit?: 'cm' | 'ft';
  blood_sugar?: number;
  blood_sugar_type?: 'fasting' | 'random' | 'post_meal';
  notes?: string;
  source?: 'manual' | 'device' | 'clinic';
}

export interface VitalFilters {
  user_id?: string;
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
  avg_heart_rate: number | null;
  avg_weight: number | null;
  avg_blood_sugar: number | null;
  records_count: number;
}

// ============================================================================
// Medication Types
// ============================================================================

export interface Medication {
  id: string;
  user_id: string;
  family_member_id: string | null;
  prescription_id: string | null;
  name: string;
  generic_name: string | null;
  dosage: string;
  dosage_unit: string;
  frequency: MedicationFrequency;
  timing: MedicationTiming[];
  duration_days: number | null;
  start_date: string;
  end_date: string | null;
  instructions: string | null;
  is_active: boolean;
  prescribed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'thrice_daily'
  | 'four_times_daily'
  | 'every_4_hours'
  | 'every_6_hours'
  | 'every_8_hours'
  | 'every_12_hours'
  | 'weekly'
  | 'as_needed';

export type MedicationTiming =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'before_meal'
  | 'after_meal'
  | 'with_meal'
  | 'empty_stomach'
  | 'bedtime';

export interface MedicationWithReminders extends Medication {
  reminders: MedicationReminder[];
  adherence_rate?: number;
  missed_doses?: number;
}

export interface CreateMedicationInput {
  family_member_id?: string;
  prescription_id?: string;
  name: string;
  generic_name?: string;
  dosage: string;
  dosage_unit: string;
  frequency: MedicationFrequency;
  timing: MedicationTiming[];
  duration_days?: number;
  start_date: string;
  end_date?: string;
  instructions?: string;
  prescribed_by?: string;
  create_reminders?: boolean;
}

export interface UpdateMedicationInput {
  name?: string;
  generic_name?: string;
  dosage?: string;
  dosage_unit?: string;
  frequency?: MedicationFrequency;
  timing?: MedicationTiming[];
  duration_days?: number;
  end_date?: string;
  instructions?: string;
  is_active?: boolean;
}

// ============================================================================
// Medication Reminder Types
// ============================================================================

export interface MedicationReminder {
  id: string;
  medication_id: string;
  user_id: string;
  family_member_id: string | null;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  taken_at: string | null;
  skipped_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReminderAction {
  reminder_id: string;
  action: 'take' | 'skip';
  notes?: string;
  skipped_reason?: string;
}

export interface ReminderFilters {
  user_id?: string;
  family_member_id?: string;
  medication_id?: string;
  status?: 'pending' | 'taken' | 'skipped' | 'missed';
  date: string;
}

// ============================================================================
// Allergy Types
// ============================================================================

export interface Allergy {
  id: string;
  user_id: string;
  family_member_id: string | null;
  allergen: string;
  allergy_type: 'food' | 'drug' | 'environmental' | 'other';
  severity: 'mild' | 'moderate' | 'severe';
  reaction: string | null;
  diagnosed_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateAllergyInput {
  family_member_id?: string;
  allergen: string;
  allergy_type: 'food' | 'drug' | 'environmental' | 'other';
  severity: 'mild' | 'moderate' | 'severe';
  reaction?: string;
  diagnosed_date?: string;
  notes?: string;
}

// ============================================================================
// Medical History Types
// ============================================================================

export interface MedicalCondition {
  id: string;
  user_id: string;
  family_member_id: string | null;
  condition_name: string;
  condition_type: 'chronic' | 'acute' | 'recurring';
  diagnosed_date: string | null;
  resolved_date: string | null;
  treating_doctor: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Surgery {
  id: string;
  user_id: string;
  family_member_id: string | null;
  procedure_name: string;
  surgery_date: string;
  hospital_name: string | null;
  surgeon_name: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// Health Summary Types
// ============================================================================

export interface HealthSummary {
  user: {
    id: string;
    full_name: string | null;
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
  member: FamilyMember;
  latest_vitals: VitalRecord | null;
  active_medications: Medication[];
  allergies: Allergy[];
  conditions: MedicalCondition[];
  upcoming_reminders: MedicationReminder[];
}
