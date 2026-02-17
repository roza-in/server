import type { VerificationStatus, HospitalType } from '../../types/database.types.js';

// =========================================================================
// Dashboard
// =========================================================================

export interface DashboardStats {
  totalUsers: number;
  totalHospitals: number;
  totalDoctors: number;
  totalAppointments: number;
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
  hospitalId?: string;
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


