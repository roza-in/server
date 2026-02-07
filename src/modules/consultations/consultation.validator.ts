// @ts-nocheck
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
    notes: z.string().max(5000),
  }),
});

// Update consultation vitals schema
export const updateConsultationVitalsSchema = z.object({
  params: z.object({
    consultationId: uuidSchema,
  }),
  body: z.object({
    vitals: z.record(z.any()),
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
    status: z.enum(['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
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

// Create prescription schema
export const createPrescriptionSchema = z.object({
  body: z.object({
    consultationId: uuidSchema,
    appointmentId: uuidSchema,
    diagnosis: z.string().min(1).max(1000),
    chiefComplaints: z.string().max(1000).optional(),
    clinicalNotes: z.string().max(2000).optional(),
    medications: z.array(medicationSchema).min(1).max(20),
    labTests: z.array(z.string()).max(20).optional(),
    advice: z.string().max(1000).optional(),
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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


