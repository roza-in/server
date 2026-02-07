import { z } from 'zod';
import { uuidSchema, dateSchema, genderSchema, phoneSchema, emailSchema } from '../../common/validators.js';

/**
 * Health Records Validators - Production-ready validation schemas
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
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    allergies: z.array(z.string().max(100)).max(20).optional(),
    chronic_conditions: z.array(z.string().max(100)).max(20).optional(),
    emergency_contact: z.boolean().default(false),
  }),
});

export const updateFamilyMemberSchema = z.object({
  params: z.object({
    memberId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(2).max(255).trim().optional(),
    relationship: relationshipSchema.optional(),
    gender: genderSchema.optional(),
    date_of_birth: dateSchema.optional().nullable(),
    blood_group: bloodGroupSchema.optional().nullable(),
    phone: phoneSchema.optional().nullable(),
    email: emailSchema.optional().nullable(),
    avatar_url: z.string().url().optional().nullable(),
    allergies: z.array(z.string().max(100)).max(20).optional().nullable(),
    chronic_conditions: z.array(z.string().max(100)).max(20).optional().nullable(),
    emergency_contact: z.boolean().optional(),
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
    document_type: documentTypeSchema,
    title: z.string().min(2).max(255).trim(),
    description: z.string().max(1000).optional(),
    file_url: z.string().url(),
    file_name: z.string().min(1).max(255),
    file_size: z.number().positive().max(50 * 1024 * 1024), // 50MB max
    mime_type: z.string().max(100),
    tags: z.array(z.string().max(50)).max(10).optional(),
    is_shared_with_doctors: z.boolean().default(false),
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
    tags: z.array(z.string().max(50)).max(10).optional().nullable(),
    is_shared_with_doctors: z.boolean().optional(),
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
    tags: z.string().transform(val => val.split(',').map(t => t.trim()).filter(Boolean)).optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    search: z.string().max(255).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  }),
});

// ============================================================================
// Vital Records Validators
// ============================================================================

const temperatureUnitSchema = z.enum(['celsius', 'fahrenheit']);
const weightUnitSchema = z.enum(['kg', 'lb']);
const heightUnitSchema = z.enum(['cm', 'ft']);
const bloodSugarTypeSchema = z.enum(['fasting', 'random', 'post_meal']);
const vitalSourceSchema = z.enum(['manual', 'device', 'clinic']);

export const createVitalRecordSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    recorded_at: z.string().datetime().optional(),
    // Blood pressure (mmHg)
    blood_pressure_systolic: z.number().min(50).max(300).optional(),
    blood_pressure_diastolic: z.number().min(30).max(200).optional(),
    // Heart rate (bpm)
    heart_rate: z.number().min(30).max(300).optional(),
    // Temperature
    temperature: z.number().min(25).max(45).optional(),
    temperature_unit: temperatureUnitSchema.default('celsius'),
    // Respiratory rate (breaths/min)
    respiratory_rate: z.number().min(5).max(60).optional(),
    // Oxygen saturation (%)
    oxygen_saturation: z.number().min(50).max(100).optional(),
    // Body measurements
    weight: z.number().min(1).max(500).optional(),
    weight_unit: weightUnitSchema.default('kg'),
    height: z.number().min(30).max(300).optional(),
    height_unit: heightUnitSchema.default('cm'),
    // Blood sugar (mg/dL)
    blood_sugar: z.number().min(20).max(600).optional(),
    blood_sugar_type: bloodSugarTypeSchema.optional(),
    // Additional
    notes: z.string().max(1000).optional(),
    source: vitalSourceSchema.default('manual'),
  }).refine(
    (data) => {
      // If blood pressure provided, both values needed
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
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
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
// Medication Validators
// ============================================================================

const frequencySchema = z.enum([
  'once_daily',
  'twice_daily',
  'thrice_daily',
  'four_times_daily',
  'every_4_hours',
  'every_6_hours',
  'every_8_hours',
  'every_12_hours',
  'weekly',
  'as_needed',
]);

export const createMedicationSchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    medication_name: z.string().min(1).max(255).trim(),
    dosage: z.string().min(1).max(100),
    frequency: frequencySchema,
    times_per_day: z.number().int().min(1).max(24).default(1),
    reminder_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24),
    start_date: dateSchema,
    end_date: dateSchema.optional(),
    instructions: z.string().max(500).optional(),
    prescribed_by: z.string().max(255).optional(),
    is_active: z.boolean().default(true),
  }),
});

export const updateMedicationSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
  body: z.object({
    medication_name: z.string().min(1).max(255).trim().optional(),
    dosage: z.string().min(1).max(100).optional(),
    frequency: frequencySchema.optional(),
    times_per_day: z.number().int().min(1).max(24).optional(),
    reminder_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24).optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional().nullable(),
    instructions: z.string().max(500).optional().nullable(),
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
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  }),
});

// ============================================================================
// Reminder Action Validators
// ============================================================================

export const recordReminderActionSchema = z.object({
  params: z.object({
    medicationId: uuidSchema,
  }),
  body: z.object({
    action: z.enum(['taken', 'skipped', 'snoozed']),
    scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
    taken_at: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
  }),
});

// ============================================================================
// Allergy Validators
// ============================================================================

const allergySeveritySchema = z.enum(['mild', 'moderate', 'severe', 'life_threatening']);
const allergyTypeSchema = z.enum(['food', 'drug', 'environmental', 'insect', 'latex', 'other']);

export const createAllergySchema = z.object({
  body: z.object({
    family_member_id: uuidSchema.optional(),
    allergy_type: allergyTypeSchema,
    allergen: z.string().min(1).max(255).trim(),
    severity: allergySeveritySchema,
    reactions: z.array(z.string().max(100)).max(10).optional(),
    first_observed: dateSchema.optional(),
    diagnosed_by: z.string().max(255).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const updateAllergySchema = z.object({
  params: z.object({
    allergyId: uuidSchema,
  }),
  body: z.object({
    allergy_type: allergyTypeSchema.optional(),
    allergen: z.string().min(1).max(255).trim().optional(),
    severity: allergySeveritySchema.optional(),
    reactions: z.array(z.string().max(100)).max(10).optional().nullable(),
    first_observed: dateSchema.optional().nullable(),
    diagnosed_by: z.string().max(255).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
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
    allergy_type: allergyTypeSchema.optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(50),
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

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>['body'];
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>['body'];
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>['query'];
export type CreateVitalRecordInput = z.infer<typeof createVitalRecordSchema>['body'];
export type ListVitalsInput = z.infer<typeof listVitalsSchema>['query'];
export type CreateMedicationInput = z.infer<typeof createMedicationSchema>['body'];
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>['body'];
export type ListMedicationsInput = z.infer<typeof listMedicationsSchema>['query'];
export type RecordReminderActionInput = z.infer<typeof recordReminderActionSchema>;
export type CreateAllergyInput = z.infer<typeof createAllergySchema>['body'];
export type UpdateAllergyInput = z.infer<typeof updateAllergySchema>['body'];
export type ListAllergiesInput = z.infer<typeof listAllergiesSchema>['query'];

