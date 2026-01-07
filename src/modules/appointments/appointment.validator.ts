// @ts-nocheck
import { z } from 'zod';
import { uuidSchema, consultationTypeSchema, appointmentStatusSchema } from '../../common/validators.js';

/**
 * Appointment validators using Zod
 */

// Book appointment schema
export const bookAppointmentSchema = z.object({
  body: z.object({
    doctorId: uuidSchema,
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    consultationType: consultationTypeSchema,
    symptoms: z.string().max(1000).optional(),
    notes: z.string().max(500).optional(),
  }),
});

// Get appointment schema
export const getAppointmentSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
});

// List appointments schema
export const listAppointmentsSchema = z.object({
  query: z.object({
    patientId: uuidSchema.optional(),
    doctorId: uuidSchema.optional(),
    hospitalId: uuidSchema.optional(),
    status: z.union([
      appointmentStatusSchema,
      z.string().transform(val => val.split(',') as any),
    ]).optional(),
    consultationType: consultationTypeSchema.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paymentStatus: z.enum(['pending', 'captured', 'refunded', 'failed']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    sortBy: z.enum(['appointmentDate', 'createdAt']).default('appointmentDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Reschedule appointment schema
export const rescheduleAppointmentSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
  body: z.object({
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newStartTime: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string().max(500).optional(),
  }),
});

// Cancel appointment schema
export const cancelAppointmentSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

// Update appointment status schema
export const updateAppointmentStatusSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
  body: z.object({
    status: appointmentStatusSchema,
    notes: z.string().max(500).optional(),
  }),
});

// Check in schema
export const checkInSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
});

// Start consultation schema
export const startConsultationSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
});

// Complete consultation schema
export const completeConsultationSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
  body: z.object({
    notes: z.string().max(2000).optional(),
  }),
});

// Rate appointment schema
export const rateAppointmentSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
  body: z.object({
    rating: z.number().min(1).max(5),
    review: z.string().max(1000).optional(),
  }),
});

// Export types
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>['body'];
export type GetAppointmentInput = z.infer<typeof getAppointmentSchema>['params'];
export type ListAppointmentsInput = z.infer<typeof listAppointmentsSchema>['query'];
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>['params'];
export type StartConsultationInput = z.infer<typeof startConsultationSchema>['params'];
export type CompleteConsultationInput = z.infer<typeof completeConsultationSchema>;
export type RateAppointmentInput = z.infer<typeof rateAppointmentSchema>;

