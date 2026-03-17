import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

/**
 * Consultation validators using Zod
 */

// Start consultation schema
export const startConsultationSchema = z.object({
  body: z.object({
    appointmentId: uuidSchema,
  }),
});

// End consultation schema
export const endConsultationSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
  body: z.object({
    notes: z.string().max(2000).optional(),
  }),
});

// Get consultation schema
export const getConsultationSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
});

// Update consultation notes schema
export const updateConsultationNotesSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
  body: z.object({
    chiefComplaint: z.string().max(1000).optional(),
    historyOfIllness: z.string().max(2000).optional(),
    examinationFindings: z.string().max(2000).optional(),
    diagnosis: z.string().max(2000).optional(),
    treatmentPlan: z.string().max(5000).optional(),
  }),
});

// Update consultation vitals schema
export const updateConsultationVitalsSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
  body: z.object({
    vitals: z.record(z.string(), z.any()),
  }),
});

// Get consultation status schema
export const getConsultationStatusSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
});

// List consultations schema
export const listConsultationsSchema = z.object({
  query: z.object({
    doctorId: uuidSchema.optional(),
    patientId: uuidSchema.optional(),
    appointmentId: uuidSchema.optional(),
    status: z.enum(['scheduled', 'waiting', 'in_progress', 'paused', 'completed', 'cancelled', 'failed']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('20').transform(Number),
  }),
});

// Medication schema
const medicationSchema = z.object({
  name: z.string().min(1).max(255),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: z.string().min(1).max(100),
  timing: z.string().min(1).max(100),
  instructions: z.string().max(500).optional(),
});

// Create prescription schema — aligned with DB Prescription table
export const createPrescriptionSchema = z.object({
  body: z.object({
    consultationId: uuidSchema,
    diagnosis: z.array(z.string().min(1).max(500)).min(1).max(20),
    medications: z.array(medicationSchema).min(1).max(20),
    labTests: z.array(z.string()).max(20).optional(),
    imagingTests: z.array(z.string()).max(20).optional(),
    dietAdvice: z.string().max(1000).optional(),
    lifestyleAdvice: z.string().max(1000).optional(),
    generalInstructions: z.string().max(2000).optional(),
    followUpDays: z.number().int().min(1).max(365).optional(),
    followUpNotes: z.string().max(1000).optional(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

// Get prescription schema
export const getPrescriptionSchema = z.object({
  params: z.object({
    prescriptionId: uuidSchema,
  }),
});

// Join consultation schema
export const joinConsultationSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
});

// Get video token schema
export const getVideoTokenSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
});

// Export types
export type StartConsultationInput = z.infer<typeof startConsultationSchema>['body'];
export type EndConsultationInput = z.infer<typeof endConsultationSchema>;
export type ListConsultationsInput = z.infer<typeof listConsultationsSchema>['query'];
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>['body'];
export type UpdateConsultationNotesInput = z.infer<typeof updateConsultationNotesSchema>;
export type UpdateConsultationVitalsInput = z.infer<typeof updateConsultationVitalsSchema>;
export type JoinConsultationInput = z.infer<typeof joinConsultationSchema>;


