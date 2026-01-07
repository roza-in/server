// @ts-nocheck
import { z } from 'zod';
import { phoneSchema, emailSchema, pincodeSchema, coordinatesSchema, uuidSchema } from '../../common/validators.js';

/**
 * Hospital validators using Zod
 */

// Update hospital schema
export const updateHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(2).max(255).optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional().nullable(),
    addressLine1: z.string().min(5).max(255).optional(),
    addressLine2: z.string().max(255).optional().nullable(),
    city: z.string().min(2).max(100).optional(),
    state: z.string().min(2).max(100).optional(),
    pincode: pincodeSchema.optional(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    about: z.string().max(2000).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    bannerUrl: z.string().url().optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional().nullable(),
    specialties: z.array(z.string()).optional().nullable(),
    facilities: z.array(z.string()).optional().nullable(),
    openingHours: z.record(z.string(), z.any()).optional().nullable(),
    registrationNumber: z.string().min(5).max(100).optional().nullable(),
    accreditations: z.array(z.string()).optional().nullable(),
  }),
});

// Get hospital by ID schema
export const getHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema.optional(),
    slug: z.string().min(1).max(255).optional(),
  }).refine(data => data.hospitalId || data.slug, {
    message: 'Either hospitalId or slug is required',
  }),
});

// List hospitals schema
export const listHospitalsSchema = z.object({
  query: z.object({
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    specialty: z.string().max(100).optional(),
    verified: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
    search: z.string().max(255).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    sortBy: z.enum(['name', 'rating', 'totalDoctors', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    latitude: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).optional(),
    longitude: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).optional(),
    radius: z.string().regex(/^\d+$/).transform(Number).default('10'),
  }),
});

// Hospital stats period schema
export const hospitalStatsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.enum(['today', 'week', 'month', 'year', 'all']).default('month'),
  }),
});

// Add doctor to hospital schema
export const addDoctorToHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    phone: phoneSchema,
    fullName: z.string().min(2).max(255),
    email: emailSchema.optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    medicalCouncilRegistration: z.string().min(5).max(100),
    medicalCouncilState: z.string().min(2).max(100),
    registrationYear: z.number().min(1950).max(new Date().getFullYear()).optional(),
    qualification: z.string().min(2).max(255),
    specialization: z.string().min(2).max(100),
    subSpecialization: z.string().max(100).optional(),
    experienceYears: z.number().min(0).max(70),
    bio: z.string().max(2000).optional(),
    languagesSpoken: z.array(z.string()).optional(),
    consultationDuration: z.number().min(5).max(120).default(15),
    consultationTypes: z.enum(['online', 'in_person', 'both']).default('both'),
    feeInPerson: z.number().min(0).optional(),
    feeOnline: z.number().min(0).optional(),
    feeFollowup: z.number().min(0).optional(),
    payoutModel: z.enum(['fixed_per_consultation', 'percentage', 'monthly_retainer', 'custom']).default('percentage'),
    payoutValue: z.number().min(0).default(70),
    paymentFrequency: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  }),
});

// Verify hospital schema (admin only)
export const verifyHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    status: z.enum(['verified', 'rejected', 'suspended']),
    notes: z.string().max(1000).optional(),
  }),
});

// Export types
export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>['body'];
export type GetHospitalInput = z.infer<typeof getHospitalSchema>['params'];
export type ListHospitalsInput = z.infer<typeof listHospitalsSchema>['query'];
export type HospitalStatsInput = z.infer<typeof hospitalStatsSchema>;
export type AddDoctorToHospitalInput = z.infer<typeof addDoctorToHospitalSchema>['body'];
export type VerifyHospitalInput = z.infer<typeof verifyHospitalSchema>;

