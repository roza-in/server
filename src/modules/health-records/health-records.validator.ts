import { z } from 'zod';
import { uuidSchema, dateSchema, genderSchema } from '../../common/validators.js';

/**
 * Health Records Validators — aligned with database schema
 */

// ============================================================================
// Family Member Validators
// ============================================================================

const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'unknown']);
const relationshipSchema = z.enum(['self', 'spouse', 'parent', 'child', 'sibling', 'other']);

export const createFamilyMemberSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(255).trim(),
    relationship: relationshipSchema,
    gender: genderSchema.optional(),
    date_of_birth: dateSchema.optional(),
    blood_group: bloodGroupSchema.optional(),
    medical_conditions: z.array(z.string().max(100)).max(20).optional(),
    allergies: z.array(z.string().max(100)).max(20).optional(),
  }),
});

export const updateFamilyMemberSchema = z.object({
  params: z.object({
    memberId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(2).max(255).trim().optional(),
    relationship: relationshipSchema.optional(),
    gender: genderSchema.optional().nullable(),
    date_of_birth: dateSchema.optional().nullable(),
    blood_group: bloodGroupSchema.optional().nullable(),
    medical_conditions: z.array(z.string().max(100)).max(20).optional().nullable(),
    allergies: z.array(z.string().max(100)).max(20).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
});

export const getFamilyMemberSchema = z.object({
  params: z.object({
    memberId: uuidSchema,
  }),
});

export const deleteFamilyMemberSchema = z.object({
  params: z.object({
    memberId: uuidSchema,
  }),
});

// ============================================================================
// Health Document Validators
// ============================================================================

const documentTypeSchema = z.enum([
  'prescription',
  'lab_report',
  'imaging',
  'medical_certificate',
  'discharge_summary',
  'insurance_document',
  'vaccination_record',
  'other',
]);

export const uploadDocumentSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    appointment_id: uuidSchema.optional(),
    consultation_id: uuidSchema.optional(),
    document_type: documentTypeSchema,
    title: z.string().min(2).max(255).trim(),
    description: z.string().max(1000).optional(),
    file_url: z.string().url(),
    file_name: z.string().min(1).max(255).optional(),
    file_size: z.number().positive().max(50 * 1024 * 1024).optional(),
    mime_type: z.string().max(100).optional(),
    document_date: dateSchema.optional(),
    hospital_name: z.string().max(255).optional(),
    doctor_name: z.string().max(255).optional(),
    is_shared: z.boolean().default(false),
    shared_doctors: z.array(uuidSchema).optional(),
  }),
});

export const updateDocumentSchema = z.object({
  params: z.object({
    documentId: uuidSchema,
  }),
  body: z.object({
    document_type: documentTypeSchema.optional(),
    title: z.string().min(2).max(255).trim().optional(),
    description: z.string().max(1000).optional().nullable(),
    document_date: dateSchema.optional().nullable(),
    is_shared: z.boolean().optional(),
    shared_doctors: z.array(uuidSchema).optional().nullable(),
  }),
});

export const getDocumentSchema = z.object({
  params: z.object({
    documentId: uuidSchema,
  }),
});

export const deleteDocumentSchema = z.object({
  params: z.object({
    documentId: uuidSchema,
  }),
});

export const listDocumentsSchema = z.object({
  query: z.object({
    family_member_id: uuidSchema.optional(),
    appointment_id: uuidSchema.optional(),
    document_type: documentTypeSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    search: z.string().max(255).optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('20').transform(Number),
  }),
});

// ============================================================================
// Vital Records Validators (patient_vitals table)
// ============================================================================

export const createVitalRecordSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    consultation_id: uuidSchema.optional(),
    recorded_at: z.string().datetime().optional(),
    // Blood pressure (mmHg)
    blood_pressure_systolic: z.number().min(50).max(300).optional(),
    blood_pressure_diastolic: z.number().min(30).max(200).optional(),
    // Pulse rate (bpm)
    pulse_rate: z.number().min(30).max(300).optional(),
    // Temperature (Celsius)
    temperature: z.number().min(25).max(45).optional(),
    // SpO2 (%)
    spo2: z.number().min(50).max(100).optional(),
    // Body measurements
    weight: z.number().min(1).max(500).optional(),
    height: z.number().min(30).max(300).optional(),
    // Blood sugar (mg/dL)
    blood_sugar_fasting: z.number().min(20).max(600).optional(),
    blood_sugar_pp: z.number().min(20).max(600).optional(),
    // Additional
    notes: z.string().max(1000).optional(),
    recorded_by: uuidSchema.optional(),
  }).refine(
    (data) => {
      if (data.blood_pressure_systolic || data.blood_pressure_diastolic) {
        return data.blood_pressure_systolic && data.blood_pressure_diastolic;
      }
      return true;
    },
    { message: 'Both systolic and diastolic blood pressure are required together' }
  ),
});

export const listVitalsSchema = z.object({
  query: z.object({
    family_member_id: uuidSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('20').transform(Number),
  }),
});

export const getVitalSchema = z.object({
  params: z.object({
    vitalId: uuidSchema,
  }),
});

export const deleteVitalSchema = z.object({
  params: z.object({
    vitalId: uuidSchema,
  }),
});

// ============================================================================
// Medication Validators (patient_medications table)
// ============================================================================

export const createMedicationSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    prescription_id: uuidSchema.optional(),
    medication_name: z.string().min(1).max(255).trim(),
    generic_name: z.string().max(255).optional(),
    dosage: z.string().min(1).max(100).optional(),
    frequency: z.string().max(100).optional(),
    route: z.string().max(100).optional(),
    start_date: dateSchema,
    end_date: dateSchema.optional(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(500).optional(),
    prescribed_by: z.string().max(255).optional(),
  }),
});

export const updateMedicationSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
  body: z.object({
    medication_name: z.string().min(1).max(255).trim().optional(),
    generic_name: z.string().max(255).optional().nullable(),
    dosage: z.string().min(1).max(100).optional(),
    frequency: z.string().max(100).optional(),
    route: z.string().max(100).optional().nullable(),
    end_date: dateSchema.optional().nullable(),
    reason: z.string().max(500).optional(),
    notes: z.string().max(500).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
});

export const getMedicationSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
});

export const deleteMedicationSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
});

export const listMedicationsSchema = z.object({
  query: z.object({
    family_member_id: uuidSchema.optional(),
    is_active: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('20').transform(Number),
  }),
});

// ============================================================================
// Medication Reminder Validators (medication_reminders table)
// ============================================================================

export const createMedicationReminderSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    prescription_id: uuidSchema.optional(),
    medicine_id: uuidSchema.optional(),
    medicine_name: z.string().min(1).max(255).trim(),
    dosage: z.string().max(100).optional(),
    instructions: z.string().max(500).optional(),
    frequency: z.string().min(1).max(100),
    reminder_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24),
    meal_timing: z.string().max(50).optional(),
    start_date: dateSchema,
    end_date: dateSchema.optional(),
    push_enabled: z.boolean().default(true),
    sms_enabled: z.boolean().default(false),
  }),
});

// ============================================================================
// Medication Action Validators (medication_logs table)
// ============================================================================

export const recordMedicationActionSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
  body: z.object({
    action: z.enum(['taken', 'skipped', 'missed']),
    scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
    taken_at: z.string().datetime().optional(),
    skipped_reason: z.string().max(500).optional(),
    notes: z.string().max(500).optional(),
  }),
});

// ============================================================================
// Allergy Validators (patient_allergies table)
// ============================================================================

const allergySeveritySchema = z.enum(['mild', 'moderate', 'severe', 'life_threatening']);
const allergenTypeSchema = z.enum(['food', 'drug', 'environmental', 'insect', 'latex', 'other']);

export const createAllergySchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    allergen_type: allergenTypeSchema,
    allergen: z.string().min(1).max(255).trim(),
    severity: allergySeveritySchema,
    reaction: z.string().max(500).optional(),
    onset_date: dateSchema.optional(),
    diagnosed_by: z.string().max(255).optional(),
  }),
});

export const updateAllergySchema = z.object({
  params: z.object({
    allergyId: uuidSchema,
  }),
  body: z.object({
    allergen_type: allergenTypeSchema.optional(),
    allergen: z.string().min(1).max(255).trim().optional(),
    severity: allergySeveritySchema.optional(),
    reaction: z.string().max(500).optional().nullable(),
    onset_date: dateSchema.optional().nullable(),
    diagnosed_by: z.string().max(255).optional().nullable(),
    is_active: z.boolean().optional(),
  }),
});

export const getAllergySchema = z.object({
  params: z.object({
    allergyId: uuidSchema,
  }),
});

export const deleteAllergySchema = z.object({
  params: z.object({
    allergyId: uuidSchema,
  }),
});

export const listAllergiesSchema = z.object({
  query: z.object({
    family_member_id: uuidSchema.optional(),
    allergen_type: allergenTypeSchema.optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('50').transform(Number),
  }),
});

// ============================================================================
// Health Summary Validators
// ============================================================================

export const getHealthSummarySchema = z.object({
  query: z.object({
    family_member_id: uuidSchema.optional(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

// Type exports omitted — canonical types live in health-records.types.ts

