// @ts-nocheck
import { z } from 'zod';
import { phoneSchema, emailSchema, pincodeSchema, coordinatesSchema, uuidSchema } from '../../common/validators.js';

/**
 * Hospital validators using Zod
 */

// Update hospital schema (body only)
export const updateHospitalBodySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional().nullable(),
  address: z.string().min(5).max(255).optional(),
  landmark: z.string().max(255).optional().nullable(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  pincode: pincodeSchema.optional(),
  country: z.string().max(50).optional().default('India'),
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
  bankAccountName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
});

export const updateHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: updateHospitalBodySchema,
});

// Update payment settings schema
export const updatePaymentSettingsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    payment_gateway_enabled: z.boolean(),
    platform_fee_online: z.number().min(0).max(100).optional(),
    platform_fee_in_person: z.number().min(0).max(100).optional(),
    platform_fee_walk_in: z.number().min(0).max(100).optional(),
    auto_settlement: z.boolean().optional(),
    settlement_frequency: z.string().optional(),
    bank_account_name: z.string().optional(),
    bank_account_number: z.string().optional(),
    bank_ifsc: z.string().optional(),
    bank_branch: z.string().optional(),
    upi_id: z.string().optional(),
    gstin: z.string().optional(),
    pan: z.string().optional(),
  }),
});

// Patients Filter Schema
export const listHospitalPatientsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// Appointments Filter Schema
export const listHospitalAppointmentsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    status: z.string().optional(),
    doctorId: uuidSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// Billing/Payments Filter Schema
export const listHospitalPaymentsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
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
export type UpdateHospitalInput = z.infer<typeof updateHospitalBodySchema>;
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>['body'];
export type GetHospitalInput = z.infer<typeof getHospitalSchema>['params'];
export type ListHospitalsInput = z.infer<typeof listHospitalsSchema>['query'];
export type HospitalStatsInput = z.infer<typeof hospitalStatsSchema>;
export type AddDoctorToHospitalInput = z.infer<typeof addDoctorToHospitalSchema>['body'];
export type VerifyHospitalInput = z.infer<typeof verifyHospitalSchema>;
export type ListHospitalPatientsInput = z.infer<typeof listHospitalPatientsSchema>;
export type ListHospitalAppointmentsInput = z.infer<typeof listHospitalAppointmentsSchema>;
export type ListHospitalPaymentsInput = z.infer<typeof listHospitalPaymentsSchema>;


