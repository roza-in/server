import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { cacheGetOrSet, cacheInvalidate, cacheInvalidateByPrefix, CacheKeys, CacheTTL } from '../../config/redis.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';
import type { DashboardStats, AnalyticsOverview, TrendPoint, PaginatedMeta } from './admin.types.js';
import type { VerifyHospitalBody, VerifyDoctorBody } from './admin.validator.js';

/**
 * Admin Service — admin-specific operations
 *
 * Domain CRUD lives in their respective modules (hospitals, doctors, users, etc.).
 * This service handles:
 *   - Dashboard stats & analytics
 *   - Hospital / Doctor verification workflows
 *   - Audit logs
 *   - Platform config (settings)
 *   - Reports
 */
class AdminService {
  private supabase = supabaseAdmin;
  private log = logger.child('AdminService');

  // =========================================================================
  // DASHBOARD & OVERVIEW
  // =========================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      { count: totalUsers },
      { count: totalHospitals },
      { count: totalDoctors },
      { count: totalAppointments },
    ] = await Promise.all([
      this.supabase.from('users').select('id', { count: 'exact', head: true }),
      this.supabase.from('hospitals').select('id', { count: 'exact', head: true }),
      this.supabase.from('doctors').select('id', { count: 'exact', head: true }),
      this.supabase.from('appointments').select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalUsers: totalUsers ?? 0,
      totalHospitals: totalHospitals ?? 0,
      totalDoctors: totalDoctors ?? 0,
      totalAppointments: totalAppointments ?? 0,
    };
  }

  async getRevenue() {
    // Use Supabase count + RPC or paginated sum to avoid fetching all rows
    // Safety limit: fetch at most 10000 rows for aggregation
    const { data } = await this.supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed' as any)
      .limit(10000);

    const total = (data || []).reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
    return { total };
  }

  async getUserGrowth(filters: { startDate?: string; endDate?: string; groupBy?: string; role?: string }) {
    const { startDate, endDate, groupBy = 'day', role } = filters;

    let query = this.supabase.from('users').select('created_at, role');
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (role) query = query.eq('role', role as any);

    // Safety limit for aggregation queries
    const { data } = await query.limit(10000);

    const byDate: Record<string, number> = {};
    (data || []).forEach((u: any) => {
      const d = new Date(u.created_at);
      let key: string;
      if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = d.toISOString().split('T')[0];
      }
      byDate[key] = (byDate[key] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }

  // =========================================================================
  // HOSPITAL LISTING & MANAGEMENT
  // =========================================================================

  async listHospitals(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('hospitals')
      .select('*, doctors:doctors(count), appointments:appointments(count)', { count: 'exact' });

    if (filters.status) {
      query = query.eq('verification_status', filters.status);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.search) {
      // P4: Sanitize search input to prevent PostgREST filter injection
      const s = sanitizeSearchInput(filters.search);
      if (s) query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%,email.ilike.%${s}%`);
    }

    // Sorting — only allow valid DB columns
    const sortCol = filters.sortBy || 'created_at';
    const sortAsc = filters.sortOrder === 'asc';
    const dbColumns = ['name', 'created_at', 'city', 'state', 'verification_status', 'type', 'is_active', 'email', 'phone'];

    if (dbColumns.includes(sortCol)) {
      query = query.order(sortCol, { ascending: sortAsc });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list hospitals', error);
      throw new BadRequestError('Failed to list hospitals');
    }

    const hospitals = (data || []).map((h: any) => ({
      ...h,
      doctorCount: h.doctors?.[0]?.count || 0,
      appointmentCount: h.appointments?.[0]?.count || 0,
    }));

    // In-memory sort for computed columns (current page only)
    if (sortCol === 'doctorCount') {
      hospitals.sort((a: any, b: any) => sortAsc ? a.doctorCount - b.doctorCount : b.doctorCount - a.doctorCount);
    } else if (sortCol === 'appointmentCount') {
      hospitals.sort((a: any, b: any) => sortAsc ? a.appointmentCount - b.appointmentCount : b.appointmentCount - a.appointmentCount);
    }

    const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    return { hospitals, meta };
  }

  async updateHospitalStatus(id: string, is_active: boolean) {
    const { error } = await this.supabase
      .from('hospitals')
      .update({ is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to update hospital status');
  }

  async deleteHospital(id: string) {
    // Soft-delete by deactivating
    const { error } = await this.supabase
      .from('hospitals')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to deactivate hospital');
  }

  async verifyHospital(hospitalId: string, payload: VerifyHospitalBody) {
    const update: Record<string, any> = {
      verification_status: payload.status,
      updated_at: new Date().toISOString(),
    };

    if (payload.status === 'verified') {
      update.verified_at = new Date().toISOString();
    }
    if (payload.status === 'rejected' && payload.remarks) {
      update.rejection_reason = payload.remarks;
    }

    const { data, error } = await this.supabase
      .from('hospitals')
      .update(update)
      .eq('id', hospitalId)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to verify hospital', error);
      throw new BadRequestError('Failed to verify hospital');
    }
    return data;
  }

  // =========================================================================
  // DOCTOR LISTING & MANAGEMENT
  // =========================================================================

  async listDoctors(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(id, name, email, phone, avatar_url),
        hospital:hospitals!doctors_hospital_id_fkey(id, name),
        specialization:specializations!doctors_specialization_id_fkey(id, name)
      `, { count: 'exact' });

    if (filters.status) {
      query = query.eq('verification_status', filters.status);
    }
    if (filters.hospitalId) {
      query = query.eq('hospital_id', filters.hospitalId);
    }
    if (filters.search) {
      // P4: Sanitize search input
      const s = sanitizeSearchInput(filters.search);
      if (s) query = query.or(`registration_number.ilike.%${s}%,registration_council.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list doctors', error);
      throw new BadRequestError('Failed to list doctors');
    }

    const doctors = (data || []).map((d: any) => ({
      ...d,
      name: d.user?.name,
      hospitalName: d.hospital?.name,
      specializationName: d.specialization?.name,
    }));

    const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    return { doctors, meta };
  }

  async verifyDoctor(doctorId: string, payload: VerifyDoctorBody) {
    const update: Record<string, any> = {
      verification_status: payload.status,
      updated_at: new Date().toISOString(),
    };

    if (payload.status === 'verified') {
      update.verified_at = new Date().toISOString();
    }
    if (payload.status === 'rejected' && payload.remarks) {
      update.rejection_reason = payload.remarks;
    }

    const { data, error } = await this.supabase
      .from('doctors')
      .update(update)
      .eq('id', doctorId)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to verify doctor', error);
      throw new BadRequestError('Failed to verify doctor');
    }
    return data;
  }

  async updateDoctorStatus(id: string, is_active: boolean) {
    const { error } = await this.supabase
      .from('doctors')
      .update({ is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to update doctor status');
  }

  // =========================================================================
  // USER LISTING & MANAGEMENT (admin view)
  // =========================================================================

  async listUsers(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('users')
      .select('id, name, email, phone, role, avatar_url, is_active, is_blocked, verification_status, last_login_at, created_at', { count: 'exact' });

    if (filters.role) query = query.eq('role', filters.role);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.is_blocked !== undefined) query = query.eq('is_blocked', filters.is_blocked);
    if (filters.search) {
      // P4: Sanitize search input
      const s = sanitizeSearchInput(filters.search);
      if (s) query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list users', error);
      throw new BadRequestError('Failed to list users');
    }

    const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    return { users: data || [], meta };
  }

  async getUser(id: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*, family_members(*)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('User not found');
    return data;
  }

  async updateUserStatus(id: string, is_active: boolean) {
    const { error } = await this.supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to update user status');
  }

  async deleteUser(id: string) {
    // Soft-delete: deactivate + block
    const { error } = await this.supabase
      .from('users')
      .update({
        is_active: false,
        is_blocked: true,
        blocked_reason: 'Deactivated by admin',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to deactivate user');
  }

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  async listAuditLogs(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list audit logs', error);
      throw new BadRequestError('Failed to list audit logs');
    }

    const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    return { logs: data || [], meta };
  }

  async getAuditLog(id: string) {
    const { data, error } = await this.supabase.from('audit_logs').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundError('Audit log not found');
    return data;
  }

  // =========================================================================
  // PLATFORM CONFIG (was system_settings)
  // =========================================================================

  async getSettings() {
    return cacheGetOrSet(
      CacheKeys.platformConfig(),
      async () => {
        const { data, error } = await this.supabase.from('platform_config').select('*');
        if (error) {
          this.log.error('Failed to fetch settings', error);
          throw new BadRequestError('Failed to fetch settings');
        }
        return data || [];
      },
      CacheTTL.PLATFORM_CONFIG,
    );
  }

  async getSetting(key: string) {
    return cacheGetOrSet(
      CacheKeys.platformConfigKey(key),
      async () => {
        const { data, error } = await this.supabase
          .from('platform_config')
          .select('*')
          .eq('config_key', key)
          .single();
        if (error || !data) throw new NotFoundError('Setting not found');
        return data;
      },
      CacheTTL.PLATFORM_CONFIG,
    );
  }

  async updateSetting(key: string, value: any) {
    const { data, error } = await this.supabase
      .from('platform_config')
      .upsert({
        config_key: key,
        config_value: value,
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to update setting', error);
      throw new BadRequestError('Failed to update setting');
    }

    // Invalidate platform config caches
    await Promise.all([
      cacheInvalidate(CacheKeys.platformConfig()),
      cacheInvalidate(CacheKeys.platformConfigKey(key)),
    ]);

    return data;
  }

  async resetSetting(key: string) {
    const { error } = await this.supabase
      .from('platform_config')
      .delete()
      .eq('config_key', key);

    if (error) {
      this.log.error('Failed to reset setting', error);
      throw new BadRequestError('Failed to reset setting');
    }

    // Invalidate platform config caches
    await Promise.all([
      cacheInvalidate(CacheKeys.platformConfig()),
      cacheInvalidate(CacheKeys.platformConfigKey(key)),
    ]);

    return { reset: true };
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async generateReport(type: string, _filters: any = {}) {
    return { url: `/reports/${type}/download`, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  }

  async getScheduledReports() {
    const { data, error } = await this.supabase.from('scheduled_reports').select('*');
    if (error) {
      this.log.error('Failed to fetch scheduled reports', error);
      return [];
    }
    return data || [];
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [
      { count: totalPatients },
      { count: totalDoctors },
      { count: totalHospitals },
      { count: totalAppointments },
      { count: weekAppointments },
      { count: newPatientsThisMonth },
    ] = await Promise.all([
      this.supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'patient' as any),
      this.supabase.from('doctors').select('id', { count: 'exact', head: true }),
      this.supabase.from('hospitals').select('id', { count: 'exact', head: true }),
      this.supabase.from('appointments').select('id', { count: 'exact', head: true }),
      this.supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_date', weekAgo.split('T')[0]),
      this.supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'patient' as any).gte('created_at', monthStart),
    ]);

    const { data: payments } = await this.supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed' as any)
      .limit(10000);

    const totalRevenue = (payments || []).reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);

    return {
      patients: { total: totalPatients ?? 0, newThisMonth: newPatientsThisMonth ?? 0 },
      doctors: { total: totalDoctors ?? 0 },
      hospitals: { total: totalHospitals ?? 0 },
      appointments: { total: totalAppointments ?? 0, thisWeek: weekAppointments ?? 0 },
      revenue: { total: totalRevenue },
    };
  }

  async getAppointmentTrends(period: 'day' | 'week' | 'month' = 'week'): Promise<TrendPoint[]> {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

    const { data } = await this.supabase
      .from('appointments')
      .select('scheduled_date, status')
      .gte('scheduled_date', startDate)
      .limit(10000);

    const byDate: Record<string, number> = {};
    (data || []).forEach((a: any) => {
      byDate[a.scheduled_date] = (byDate[a.scheduled_date] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }

  async getRevenueTrends(period: 'day' | 'week' | 'month' = 'week'): Promise<TrendPoint[]> {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data } = await this.supabase
      .from('payments')
      .select('total_amount, created_at')
      .eq('status', 'completed' as any)
      .gte('created_at', startDate)
      .limit(10000);

    const byDate: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      const date = p.created_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + Number(p.total_amount || 0);
    });

    return Object.entries(byDate).map(([date, amount]) => ({ date, amount }));
  }

  async getUserTrends(period: 'day' | 'week' | 'month' = 'week'): Promise<TrendPoint[]> {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data } = await this.supabase
      .from('users')
      .select('created_at, role')
      .gte('created_at', startDate)
      .limit(10000);

    const byDate: Record<string, number> = {};
    (data || []).forEach((u: any) => {
      const date = u.created_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }
}

export const adminService = new AdminService();

