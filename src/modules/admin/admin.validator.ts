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
  status: z.enum(['verified', 'rejected']).optional(),
  remarks: z.string().optional(),
});

export const requestDocumentsSchema = z.object({
  documentTypes: z.array(z.string()).min(1),
  message: z.string().optional(),
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
