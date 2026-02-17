import { z } from 'zod';
import { uuidSchema, consultationTypeSchema, consultationFeeSchema, phoneSchema, emailSchema, medicalRegistrationSchema, experienceYearsSchema } from '../../common/validators.js';

/**
 * Doctor validators using Zod
 */

// Get doctor by ID schema
export const getDoctorSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
});

// List doctors schema
export const listDoctorsSchema = z.object({
  query: z.object({
    hospitalId: uuidSchema.optional(),
    specializationId: uuidSchema.optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    consultationType: consultationTypeSchema.optional(),
    minFee: z.string().regex(/^\d+$/).transform(Number).optional(),
    maxFee: z.string().regex(/^\d+$/).transform(Number).optional(),
    minExperience: z.string().regex(/^\d+$/).transform(Number).optional(),
    minRating: z.string().regex(/^\d+\.?\d*$/).transform(Number).optional(),
    language: z.string().max(50).optional(),
    availableToday: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    search: z.string().max(255).optional(),
    page: z.string().regex(/^\d+$/).default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).default('20').transform(Number),
    sortBy: z.enum(['name', 'rating', 'experience', 'fee', 'consultations']).default('rating'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Update doctor profile schema
export const updateDoctorSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    specializationId: uuidSchema.optional(),
    qualifications: z.array(z.string().min(1)).optional(),
    experienceYears: z.number().min(0).max(70).optional(),
    bio: z.string().max(2000).optional().nullable(),
    languages: z.array(z.string()).optional(),
    consultationFeeOnline: consultationFeeSchema.optional(),
    consultationFeeInPerson: consultationFeeSchema.optional(),
    consultationFeeWalkIn: consultationFeeSchema.optional(),
    followUpFee: consultationFeeSchema.optional(),
    followUpValidityDays: z.number().int().min(1).max(90).optional(),
    slotDurationMinutes: z.number().int().min(5).max(120).optional(),
    bufferTimeMinutes: z.number().int().min(0).max(60).optional(),
    maxPatientsPerSlot: z.number().int().min(1).max(100).optional(),
    onlineConsultationEnabled: z.boolean().optional(),
    walkInEnabled: z.boolean().optional(),
    consultationTypes: z.array(consultationTypeSchema).optional(),
    isAvailable: z.boolean().optional(),
    registrationNumber: medicalRegistrationSchema.optional(),
    registrationCouncil: z.string().max(255).optional().nullable(),
  }),
});

// Create doctor schema (used by hospitals to create doctor profiles)
export const createDoctorSchema = z.object({
  body: z.object({
    user_id: uuidSchema.optional(),
    phone: phoneSchema.optional(),
    name: z.string().min(1).max(255).optional(),
    email: emailSchema.optional(),
    qualifications: z.union([
      z.array(z.string()),
      z.string().max(1000),
    ]).optional().nullable(),
    registrationNumber: medicalRegistrationSchema.optional().nullable(),
    registrationCouncil: z.string().max(255).optional().nullable(),
    specialization_id: uuidSchema.optional(),
    specializationId: uuidSchema.optional(),
    experienceYears: experienceYearsSchema.optional().nullable(),
    bio: z.string().max(2000).optional().nullable(),
    slotDurationMinutes: z.number().int().min(5).max(120).optional(),
    bufferTimeMinutes: z.number().int().min(0).max(60).optional(),
    consultationFeeOnline: consultationFeeSchema.optional().nullable(),
    consultationFeeInPerson: consultationFeeSchema.optional().nullable(),
    consultationFeeWalkIn: consultationFeeSchema.optional().nullable(),
    followUpFee: consultationFeeSchema.optional().nullable(),
    maxPatientsPerSlot: z.number().int().min(1).max(100).optional().nullable(),
    profileImageUrl: z.string().url().optional().nullable(),
    languages: z.array(z.string()).optional(),
    onlineConsultationEnabled: z.boolean().optional(),
    walkInEnabled: z.boolean().optional(),
  }).refine((v) => !!v.user_id || !!v.phone, { message: 'Either user_id or phone is required' })
    .refine((v) => !!v.specializationId || !!v.specialization_id, { message: 'specialization_id or specializationId is required' }),
});

// Get doctor availability schema
export const getDoctorAvailabilitySchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    consultationType: consultationTypeSchema.optional(),
    days: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

// Doctor stats schema
export const doctorStatsSchema = z.object({
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.enum(['today', 'week', 'month', 'year', 'all']).default('month'),
  }),
});

// Update doctor status schema (hospital/admin only)
export const updateDoctorStatusSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    is_active: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
});

// Export types
export type GetDoctorInput = z.infer<typeof getDoctorSchema>['params'];
export type ListDoctorsInput = z.infer<typeof listDoctorsSchema>['query'];
export type UpdateDoctorBody = z.infer<typeof updateDoctorSchema>['body'];
export type GetDoctorAvailabilityInput = z.infer<typeof getDoctorAvailabilitySchema>;
export type DoctorStatsInput = z.infer<typeof doctorStatsSchema>;
export type UpdateDoctorStatusInput = z.infer<typeof updateDoctorStatusSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];


