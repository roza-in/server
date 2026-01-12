// @ts-nocheck
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
    specialization: z.string().max(100).optional(),
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
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    sortBy: z.enum(['name', 'rating', 'experience', 'fee', 'createdAt']).default('rating'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// Update doctor profile schema
export const updateDoctorSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    qualification: z.string().min(2).max(255).optional(),
    specialization: z.string().min(2).max(100).optional(),
    subSpecialization: z.string().max(100).optional().nullable(),
    experienceYears: z.number().min(0).max(70).optional(),
    bio: z.string().max(2000).optional().nullable(),
    languagesSpoken: z.array(z.string()).optional(),
    consultationDuration: z.number().min(5).max(120).optional(),
    consultationTypes: consultationTypeSchema.optional(),
    feeInPerson: consultationFeeSchema.optional().nullable(),
    feeOnline: consultationFeeSchema.optional().nullable(),
    feeFollowup: consultationFeeSchema.optional().nullable(),
    isAvailableForEmergency: z.boolean().optional(),
  }),
});

// Create doctor schema (used by hospitals to create doctor profiles)
export const createDoctorSchema = z.object({
  body: z.object({
    user_id: uuidSchema.optional(),
    phone: phoneSchema.optional(),
    full_name: z.string().min(1).max(255).optional(),
    email: emailSchema.optional(),
    qualifications: z.string().max(1000).optional().nullable(),
    registrationNumber: medicalRegistrationSchema.optional().nullable(),
    registrationCouncil: z.string().max(255).optional().nullable(),
    licenseNumber: z.string().max(255).optional().nullable(),
    specialization_id: uuidSchema.optional(),
    specializationId: uuidSchema.optional(),
    specialization: z.string().max(100).optional().nullable(),
    yearsOfExperience: experienceYearsSchema.optional().nullable(),
    bio: z.string().max(2000).optional().nullable(),
    consultationDuration: z.number().int().min(5).max(120).optional(),
    consultationFeeInPerson: consultationFeeSchema.optional().nullable(),
    consultationFeeOnline: consultationFeeSchema.optional().nullable(),
    followUpFee: consultationFeeSchema.optional().nullable(),
    bufferTime: z.number().int().min(0).max(120).optional().nullable(),
    maxPatientsPerDay: z.number().int().min(1).max(1000).optional().nullable(),
    profileImageUrl: z.string().url().optional().nullable(),
    languagesSpoken: z.array(z.string()).optional(),
  }).refine((v) => !!v.user_id || !!v.phone, { message: 'Either user_id or phone is required' })
  .refine((v) => !!v.specializationId || !!v.specialization_id || (!!v.specialization && String(v.specialization).trim().length > 0), { message: 'Either specializationId/specialization_id or specialization text is required' }),
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
  }),
});

// Doctor stats schema
export const doctorStatsSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
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
    status: z.enum(['active', 'inactive', 'suspended']),
    reason: z.string().max(500).optional(),
  }),
});

// Export types
export type GetDoctorInput = z.infer<typeof getDoctorSchema>['params'];
export type ListDoctorsInput = z.infer<typeof listDoctorsSchema>['query'];
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>['body'];
export type GetDoctorAvailabilityInput = z.infer<typeof getDoctorAvailabilitySchema>;
export type DoctorStatsInput = z.infer<typeof doctorStatsSchema>;
export type UpdateDoctorStatusInput = z.infer<typeof updateDoctorStatusSchema>;
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];

