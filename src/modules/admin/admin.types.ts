import type { VerificationStatus, HospitalType, AdminTier, AuditAction } from '../../types/database.types.js';

// =========================================================================
// Dashboard
// =========================================================================

export interface DashboardStats {
  totalUsers: number;
  totalHospitals: number;
  totalDoctors: number;
  totalAppointments: number;
  finance?: FinancialKPIs;
  health?: SystemHealthStats;
}

export interface FinancialKPIs {
  dailyRevenue: number;
  pendingSettlementAmount: number;
  activeDisputeCount: number;
  failedPaymentCount24h: number;
}

export interface SystemHealthStats {
  errorCount24h: number;
  notificationQueueDepth: number;
  webhookFailures24h: number;
  pendingVerifications: number;
}

// =========================================================================
// Admin-specific listing filters
// =========================================================================

export interface AdminUserFilters {
  search?: string;
  role?: string;
  is_active?: boolean;
  is_blocked?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminHospitalFilters {
  search?: string;
  status?: VerificationStatus;
  type?: HospitalType;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AdminDoctorFilters {
  search?: string;
  status?: VerificationStatus;
  page?: number;
  limit?: number;
}

export interface AdminNotificationFilters {
  search?: string;
  status?: string;
  channel?: string;
  page?: number;
  limit?: number;
}

export interface AdminSupportFilters {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface AdminVerificationFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AdminReportFilters {
  type?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminSystemLogFilters {
  level?: string;
  module?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AdminAuditFilters {
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  phiOnly?: boolean | string;
  adminOnly?: boolean | string;
  page?: number;
  limit?: number;
}

export interface VerificationPayload {
  status: 'verified' | 'rejected' | 'under_review';
  remarks?: string;
}

// =========================================================================
// Analytics
// =========================================================================

export interface AnalyticsOverview {
  patients: { total: number; newThisMonth: number };
  doctors: { total: number };
  hospitals: { total: number };
  appointments: { total: number; thisWeek: number };
  revenue: { total: number };
}

export interface TrendPoint {
  date: string;
  count?: number;
  amount?: number;
}

// =========================================================================
// Paginated response meta
// =========================================================================

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


