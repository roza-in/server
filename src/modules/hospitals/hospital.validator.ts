import { z } from 'zod';
import { phoneSchema, emailSchema, pincodeSchema, uuidSchema, paginationSchema } from '../../common/validators.js';

/**
 * Hospital validators using Zod
 *
 * DB columns (hospitals table):
 *   name, phone, email, website, address, landmark, city, state, pincode, country,
 *   latitude, longitude, description, short_description, logo_url, banner_url, photos,
 *   facilities (TEXT[]), registration_number, accreditations (TEXT[]), gstin, pan,
 *   founding_year, number_of_employees, accepted_insurance (TEXT[]), working_hours (JSONB),
 *   emergency_services (BOOLEAN), languages_spoken (TEXT[]), meta_title, meta_description,
 *   meta_keywords (TEXT[]), og_image_url, canonical_slug, noindex, social_links (JSONB),
 *   faq_content (JSONB), platform_commission_percent, medicine_commission_percent
 */

// ============================================================================
// Param Schemas
// ============================================================================

export const hospitalIdParamSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
});

// ============================================================================
// Get / List Schemas
// ============================================================================

export const getHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
});

export const getHospitalBySlugSchema = z.object({
  params: z.object({
    slug: z.string().min(1).max(255),
  }),
});

export const listHospitalsSchema = z.object({
  query: z.object({
    search: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    type: z.enum([
      'multi_specialty', 'single_specialty', 'nursing_home',
      'clinic', 'diagnostic_center', 'medical_college', 'primary_health',
    ]).optional(),
    verification_status: z.enum(['pending', 'under_review', 'verified', 'rejected', 'suspended']).optional(),
    emergency_services: z.coerce.boolean().optional(),
    min_rating: z.coerce.number().min(0).max(5).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().min(1).max(500).optional(),
    ...paginationSchema.shape,
  }),
});

// ============================================================================
// Update Hospital Schema
// ============================================================================

export const updateHospitalBodySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  short_description: z.string().max(300).optional().nullable(),
  phone: phoneSchema.optional(),
  alternate_phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  address: z.string().min(5).max(255).optional(),
  landmark: z.string().max(255).optional().nullable(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  pincode: pincodeSchema.optional(),
  country: z.string().max(50).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  banner_url: z.string().url().optional().nullable(),
  photos: z.array(z.string().url()).max(20).optional().nullable(),
  facilities: z.array(z.string()).optional().nullable(),
  registration_number: z.string().min(5).max(100).optional().nullable(),
  accreditations: z.array(z.string()).optional().nullable(),
  founding_year: z.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  number_of_employees: z.string().max(20).optional().nullable(),
  accepted_insurance: z.array(z.string()).optional().nullable(),
  payment_methods_accepted: z.array(z.string()).optional().nullable(),
  area_served: z.array(z.string()).optional().nullable(),
  also_known_as: z.array(z.string()).optional().nullable(),
  departments: z.array(z.string()).optional().nullable(),
  languages_spoken: z.array(z.string()).optional().nullable(),
  working_hours: z.record(z.string(), z.any()).optional().nullable(),
  emergency_services: z.boolean().optional(),
  gstin: z.string().max(20).optional().nullable(),
  pan: z.string().max(20).optional().nullable(),
  // SEO
  meta_title: z.string().max(70).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  meta_keywords: z.array(z.string()).optional().nullable(),
  og_image_url: z.string().url().optional().nullable(),
  canonical_slug: z.string().max(255).optional().nullable(),
  noindex: z.boolean().optional(),
  // Social / FAQ
  social_links: z.record(z.string(), z.string()).optional().nullable(),
  faq_content: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  // Commission (admin only)
  platform_commission_percent: z.number().min(0).max(100).optional(),
  medicine_commission_percent: z.number().min(0).max(100).optional(),
});

export const updateHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: updateHospitalBodySchema,
});

// ============================================================================
// Payment Settings Schema
// ============================================================================

export const updatePaymentSettingsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    platform_commission_percent: z.number().min(0).max(100).optional(),
    medicine_commission_percent: z.number().min(0).max(100).optional(),
  }),
});

// ============================================================================
// Hospital Stats Schema
// ============================================================================

export const hospitalStatsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    period: z.enum(['week', 'month', 'quarter', 'year']).optional(),
  }),
});

// ============================================================================
// Doctor Management Schemas
// ============================================================================

export const addDoctorToHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    user_id: uuidSchema,
    specialization_id: uuidSchema,
    registration_number: z.string().min(3).max(100),
    registration_council: z.string().max(100).optional(),
    registration_year: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
    qualifications: z.array(z.string()).optional(),
    experience_years: z.number().int().min(0).max(70).default(0),
    consultation_fee_online: z.number().min(0).max(50000).default(0),
    consultation_fee_in_person: z.number().min(0).max(50000).default(0),
    slot_duration_minutes: z.number().int().min(5).max(120).default(15),
  }),
});

// ============================================================================
// Patients / Appointments / Payments Filter Schemas
// ============================================================================

export const listHospitalPatientsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    search: z.string().optional(),
    ...paginationSchema.shape,
  }),
});

export const listHospitalAppointmentsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    status: z.string().optional(),
    doctorId: uuidSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
    ...paginationSchema.shape,
  }),
});

export const listHospitalPaymentsSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  query: z.object({
    status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ...paginationSchema.shape,
  }),
});

// ============================================================================
// Verify Hospital Schema (admin only)
// ============================================================================

export const verifyHospitalSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    status: z.enum(['verified', 'rejected', 'suspended']),
    rejection_reason: z.string().max(1000).optional(),
  }),
});

// ============================================================================
// Staff Management Schema
// ============================================================================

export const addStaffSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema.optional(),
  }),
});

export const removeStaffSchema = z.object({
  params: z.object({
    hospitalId: uuidSchema,
    staffId: uuidSchema,
  }),
});

// ============================================================================
// Exported Types (inferred from schemas)
// ============================================================================

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
export type AddStaffInput = z.infer<typeof addStaffSchema>['body'];


