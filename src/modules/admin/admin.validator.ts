import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
  isVerified: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
});

export const userGrowthQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  role: z.string().optional(),
});

export const verifyHospitalSchema = z.object({
  status: z.enum(['verified', 'rejected', 'under_review']),
  remarks: z.string().optional(),
});

export const updateHospitalSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  websiteUrl: z.string().url().optional().nullable(),
  hospitalType: z.string().optional(),
  address: z.string().optional(),
  landmark: z.string().optional().nullable(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional().default('India'),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  about: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  specialties: z.array(z.string()).optional(),
  facilities: z.array(z.string()).optional(),
  totalBeds: z.number().int().nonnegative().optional(),
  icuBeds: z.number().int().nonnegative().optional(),
  registrationNumber: z.string().optional(),
  gstin: z.string().optional(),
  licenseNumber: z.string().optional(),
  panNumber: z.string().optional(),
  subscriptionTier: z.enum(['basic', 'pro', 'enterprise']).optional(),
});

export const requestDocumentsSchema = z.object({
  documentTypes: z.array(z.string()).min(1),
  message: z.string().optional(),
});

// Doctor Verification Schemas
export const verifyDoctorSchema = z.object({
  status: z.enum(['verified', 'rejected', 'under_review']),
  remarks: z.string().optional(),
});

export const listDoctorsQuerySchema = z.object({
  search: z.string().optional(),
  verificationStatus: z.enum(['pending', 'under_review', 'verified', 'rejected', 'suspended']).optional(),
  hospitalId: z.string().uuid().optional(),
  page: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
});

export const ticketFiltersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
});

export const ticketUpdateSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const ticketReplySchema = z.object({
  message: z.string().min(1),
  attachments: z.array(z.string()).optional(),
});

export const settingUpdateSchema = z.object({
  value: z.any(),
});

export const reportTypeSchema = z.enum(['users', 'appointments', 'payments', 'hospitals']);

export const reportFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['csv', 'xlsx', 'pdf']).optional(),
});

export const paginationQuery = z.object({
  page: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().positive().optional()),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserGrowthQuery = z.infer<typeof userGrowthQuerySchema>;
export type VerifyHospitalBody = z.infer<typeof verifyHospitalSchema>;
export type RequestDocumentsBody = z.infer<typeof requestDocumentsSchema>;
export type TicketFilters = z.infer<typeof ticketFiltersSchema>;
export type TicketUpdateBody = z.infer<typeof ticketUpdateSchema>;
export type TicketReplyBody = z.infer<typeof ticketReplySchema>;
export type SettingUpdateBody = z.infer<typeof settingUpdateSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type VerifyDoctorBody = z.infer<typeof verifyDoctorSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;
export type UpdateHospitalBody = z.infer<typeof updateHospitalSchema>;

