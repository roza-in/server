import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { cacheGetOrSet, cacheInvalidate, cacheInvalidateByPrefix, CacheKeys, CacheTTL } from '../../config/redis.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';
import type { AdminTier } from '../../types/database.types.js';
import type { DashboardStats, AnalyticsOverview, TrendPoint, PaginatedMeta, AdminAuditFilters } from './admin.types.js';
import type { VerifyHospitalBody, VerifyDoctorBody, CreatePharmacyUserBody } from './admin.validator.js';
import { adminFinanceService } from './admin-finance.service.js';
import { platformConfigService } from '../platform-config/platform-config.service.js';

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
    const today = new Date().toISOString().split('T')[0];
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: totalHospitals },
      { count: totalDoctors },
      { count: totalAppointments },
      { data: dailyRevenueData },
      { data: pendingSettlementData },
      { count: activeDisputes },
      { count: failedPayments },
      { count: systemErrors },
      { count: pendingNotifs },
      { count: webhookFailures },
      { count: pendingHospitals },
      { count: pendingDoctors }
    ] = await Promise.all([

      this.supabase.from('users').select('id', { count: 'exact', head: true }),
      this.supabase.from('hospitals').select('id', { count: 'exact', head: true }),
      this.supabase.from('doctors').select('id', { count: 'exact', head: true }),
      this.supabase.from('appointments').select('id', { count: 'exact', head: true }),
      // Finance
      this.supabase.from('payments').select('total_amount').eq('status', 'completed' as any).gte('created_at', today),
      this.supabase.from('settlements').select('amount').eq('status', 'pending' as any),
      this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true }).eq('status', 'open' as any),
      this.supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed' as any).gte('created_at', dayAgo),
      // Health
      this.supabase.from('system_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', dayAgo),
      this.supabase.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.from('gateway_webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', dayAgo),
      // Update: Count from entity tables instead of unused hospital_verification_requests
      this.supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      this.supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    ]);


    const dailyRevenue = (dailyRevenueData || []).reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const pendingSettlementAmount = (pendingSettlementData || []).reduce((s, st) => s + Number(st.amount || 0), 0);

    return {
      totalUsers: totalUsers ?? 0,
      totalHospitals: totalHospitals ?? 0,
      totalDoctors: totalDoctors ?? 0,
      totalAppointments: totalAppointments ?? 0,
      finance: {
        dailyRevenue,
        pendingSettlementAmount,
        activeDisputeCount: activeDisputes ?? 0,
        failedPaymentCount24h: failedPayments ?? 0
      },
      health: {
        errorCount24h: systemErrors ?? 0,
        notificationQueueDepth: pendingNotifs ?? 0,
        webhookFailures24h: webhookFailures ?? 0,
        pendingVerifications: (pendingHospitals || 0) + (pendingDoctors || 0)
      }


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

  async getHospital(id: string) {
    const { data, error } = await this.supabase
      .from('hospitals')
      .select(`
        *,
        users:admin_user_id (
          id,
          name,
          email,
          phone
        ),
        doctorCount:doctors(count),
        appointmentCount:appointments(count),
        doctors:doctors(
          id,
          verification_status,
          is_active,
          specialization_id,
          user:user_id(
            id,
            name,
            email,
            phone,
            avatar_url
          ),
          specialization:specialization_id(
            id,
            name
          )
        ),
        staff:hospital_staff(
          id,
          staff_role,
          designation,
          is_active,
          user:user_id(
            id,
            name,
            email,
            phone,
            avatar_url
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Hospital not found');
    }

    // Format counts
    const hospital = {
      ...data,
      adminUser: (data as any).users || null,
      doctorCount: data.doctorCount?.[0]?.count || 0,
      appointmentCount: data.appointmentCount?.[0]?.count || 0,
    };

    return hospital;
  }

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
      license_number: payload.license_number,
      updated_at: new Date().toISOString(),
    };

    if (payload.status === 'verified') {
      update.verified_at = new Date().toISOString();
      update.is_active = true;
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

  async getDoctor(id: string) {
    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        users:users!doctors_user_id_fkey(
          id,
          name,
          email,
          phone,
          avatar_url,
          role
        ),
        hospitals:hospitals!doctors_hospital_id_fkey(
          id,
          name,
          type,
          city,
          state
        ),
        specialization:specializations!doctors_specialization_id_fkey(
          id,
          name
        ),
        appointmentCount:appointments(count)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Doctor profile not found');
    }

    return {
      ...data,
      user: (data as any).users,
      hospital: (data as any).hospitals,
      specializationName: (data as any).specialization?.name,
      appointmentCount: (data as any).appointmentCount?.[0]?.count || 0,
    };
  }

  async verifyDoctor(doctorId: string, payload: VerifyDoctorBody) {
    const update: Record<string, any> = {
      verification_status: payload.status,
      license_number: payload.license_number,
      updated_at: new Date().toISOString(),
    };

    if (payload.status === 'verified') {
      update.verified_at = new Date().toISOString();
      update.is_active = true;
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
  // PHARMACY USER MANAGEMENT
  // =========================================================================

  async createPharmacyUser(data: CreatePharmacyUserBody) {
    // Check for existing email
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existing) throw new BadRequestError('A user with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password_hash: passwordHash,
        role: 'pharmacy',
        is_active: true,
        email_verified: true,
        phone_verified: true,
      } as any)
      .select('id, name, email, phone, role, is_active, created_at')
      .single();

    if (error) {
      this.log.error('Failed to create pharmacy user', error);
      throw new BadRequestError('Failed to create pharmacy user');
    }

    return user;
  }

  async listPharmacyUsers(filters: any = {}) {

    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('users')
      .select('id, name, email, phone, role, avatar_url, is_active, is_blocked, last_login_at, created_at', { count: 'exact' })
      .eq('role', 'pharmacy' as any);

    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search);
      if (s) query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const sortCol = filters.sortBy || 'created_at';
    const sortAsc = filters.sortOrder === 'asc';
    const validCols = ['name', 'created_at', 'email'];
    if (validCols.includes(sortCol)) {
      query = query.order(sortCol, { ascending: sortAsc });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list pharmacy users', error);
      throw new BadRequestError('Failed to list pharmacy users');
    }

    const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    return { pharmacyUsers: data || [], meta };
  }

  async getPharmacyUser(id: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, name, email, phone, role, avatar_url, is_active, is_blocked, blocked_reason, last_login_at, created_at, updated_at')
      .eq('id', id)
      .eq('role', 'pharmacy' as any)
      .single();

    if (error || !data) throw new NotFoundError('Pharmacy user not found');

    // Get order stats for this pharmacy user
    const { count: totalOrders } = await this.supabase
      .from('medicine_orders')
      .select('id', { count: 'exact', head: true });

    const { count: pendingOrders } = await this.supabase
      .from('medicine_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed']);

    return {
      ...data,
      stats: {
        totalOrders: totalOrders ?? 0,
        pendingOrders: pendingOrders ?? 0,
      },
    };
  }

  async updatePharmacyUserStatus(id: string, is_active: boolean) {
    // Verify it's actually a pharmacy user
    const { data: user } = await this.supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .eq('role', 'pharmacy' as any)
      .single();

    if (!user) throw new NotFoundError('Pharmacy user not found');

    const updateData: any = {
      is_active,
      updated_at: new Date().toISOString(),
    };

    // If activating, ensure the user is also unblocked
    if (is_active) {
      updateData.is_blocked = false;
      updateData.blocked_reason = null;
    }

    const { error } = await this.supabase
      .from('users')
      .update(updateData)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to update pharmacy user status');
  }

  async deletePharmacyUser(id: string) {
    // Verify it's actually a pharmacy user
    const { data: user } = await this.supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .eq('role', 'pharmacy' as any)
      .single();

    if (!user) throw new NotFoundError('Pharmacy user not found');

    const { error } = await this.supabase
      .from('users')
      .update({
        is_active: false,
        is_blocked: true,
        blocked_reason: 'Deleted by admin',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) throw new BadRequestError('Failed to delete pharmacy user');
  }

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  async listAuditLogs(filters: AdminAuditFilters = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply Filters
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.phiOnly === 'true' || filters.phiOnly === true) {
      query = query.eq('accessed_phi', true);
    }
    if (filters.adminOnly === 'true' || filters.adminOnly === true) {
      query = query.eq('user_role', 'admin');
    }

    const { data, error, count } = await query
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
  // ADMIN ACCESS MANAGEMENT
  // =========================================================================

  async updateAdminTier(adminId: string, tier: AdminTier, updatedBy: string) {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        admin_tier: tier,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', adminId)
      .eq('role', 'admin')
      .select()
      .single();

    if (error) {
      this.log.error('Failed to update admin tier', error);
      throw new BadRequestError('Failed to update admin tier');
    }

    return data;
  }

  // =========================================================================
  // PLATFORM CONFIG (via PlatformConfigService)
  // =========================================================================

  async getSettings() {
    return platformConfigService.getSettings();
  }

  async getSetting(key: string) {
    return platformConfigService.getSetting(key);
  }

  async updateSetting(key: string, value: any, updatedBy?: string) {
    return platformConfigService.updateSetting(key, value, updatedBy);
  }

  async resetSetting(key: string) {
    return platformConfigService.resetSetting(key);
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

  // =========================================================================
  // FINANCE DELEGATION
  // =========================================================================

  async bulkApproveSettlements(ids: string[], adminId: string) {
    return adminFinanceService.bulkApproveSettlements(ids, adminId);
  }

  async bulkApproveRefunds(ids: string[], adminId: string) {
    return adminFinanceService.bulkApproveRefunds(ids, adminId);
  }
}

export const adminService = new AdminService();

