import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

// =========================================================================
// Pagination helper
// =========================================================================

const paginationFields = {
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
};

// =========================================================================
// Users
// =========================================================================

export const listUsersQuerySchema = z.object({
  query: z.object({
    search: z.string().max(255).optional(),
    role: z.enum(['patient', 'reception', 'doctor', 'hospital', 'pharmacy', 'admin']).optional(),
    is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    is_blocked: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    ...paginationFields,
  }),
});

export const getUserParamsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({ is_active: z.boolean() }),
});

export const deleteUserParamsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

// =========================================================================
// User growth / analytics query
// =========================================================================

export const userGrowthQuerySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    role: z.enum(['patient', 'reception', 'doctor', 'hospital', 'pharmacy', 'admin']).optional(),
  }),
});

export const trendPeriodSchema = z.object({
  query: z.object({
    period: z.enum(['day', 'week', 'month']).default('week'),
  }),
});

// =========================================================================
// Hospitals
// =========================================================================

export const listHospitalsQuerySchema = z.object({
  query: z.object({
    search: z.string().max(255).optional(),
    status: z.enum(['pending', 'under_review', 'verified', 'rejected', 'suspended']).optional(),
    type: z.enum([
      'multi_specialty', 'single_specialty', 'nursing_home',
      'clinic', 'diagnostic_center', 'medical_college', 'primary_health',
    ]).optional(),
    sortBy: z.enum([
      'name', 'created_at', 'city', 'state', 'verification_status',
      'type', 'is_active', 'email', 'phone', 'doctorCount', 'appointmentCount',
    ]).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    ...paginationFields,
  }),
});

export const hospitalParamsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const verifyHospitalSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    status: z.enum(['verified', 'rejected', 'under_review']),
    remarks: z.string().max(2000).optional(),
  }),
});

export const updateHospitalStatusSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({ is_active: z.boolean() }),
});

export const updateHospitalSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional(),
    website: z.string().url().optional().nullable(),
    type: z.enum([
      'multi_specialty', 'single_specialty', 'nursing_home',
      'clinic', 'diagnostic_center', 'medical_college', 'primary_health',
    ]).optional(),
    description: z.string().max(5000).optional().nullable(),
    short_description: z.string().max(500).optional().nullable(),
    address: z.string().optional().nullable(),
    landmark: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    country: z.string().optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    logo_url: z.string().url().optional().nullable(),
    banner_url: z.string().url().optional().nullable(),
    facilities: z.array(z.string()).optional().nullable(),
    registration_number: z.string().optional().nullable(),
    gstin: z.string().optional().nullable(),
    pan: z.string().optional().nullable(),
    emergency_services: z.boolean().optional(),
    platform_commission_percent: z.number().min(0).max(100).optional(),
    medicine_commission_percent: z.number().min(0).max(100).optional(),
  }),
});

// =========================================================================
// Doctors
// =========================================================================

export const listDoctorsQuerySchema = z.object({
  query: z.object({
    search: z.string().max(255).optional(),
    status: z.enum(['pending', 'under_review', 'verified', 'rejected', 'suspended']).optional(),
    hospitalId: z.string().uuid().optional(),
    ...paginationFields,
  }),
});

export const doctorParamsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

export const verifyDoctorSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    status: z.enum(['verified', 'rejected', 'under_review']),
    remarks: z.string().max(2000).optional(),
  }),
});

export const updateDoctorStatusSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({ is_active: z.boolean() }),
});

// =========================================================================
// Audit logs
// =========================================================================

export const auditLogParamsSchema = z.object({
  params: z.object({ id: uuidSchema }),
});

// =========================================================================
// Settings (platform_config)
// =========================================================================

export const settingKeySchema = z.object({
  params: z.object({ key: z.string().min(1).max(255) }),
});

export const settingUpdateSchema = z.object({
  params: z.object({ key: z.string().min(1).max(255) }),
  body: z.object({
    value: z.any(),
  }),
});

// =========================================================================
// Reports
// =========================================================================

export const reportTypeSchema = z.object({
  params: z.object({
    type: z.enum(['users', 'appointments', 'payments', 'hospitals']),
  }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  }),
});

// =========================================================================
// Inferred types
// =========================================================================

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>['query'];
export type UserGrowthQuery = z.infer<typeof userGrowthQuerySchema>['query'];
export type VerifyHospitalBody = z.infer<typeof verifyHospitalSchema>['body'];
export type VerifyDoctorBody = z.infer<typeof verifyDoctorSchema>['body'];
export type UpdateHospitalBody = z.infer<typeof updateHospitalSchema>['body'];
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>['query'];
export type SettingUpdateBody = z.infer<typeof settingUpdateSchema>['body'];
export type ReportFilters = z.infer<typeof reportTypeSchema>['query'];


