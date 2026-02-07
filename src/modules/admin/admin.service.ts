// @ts-nocheck
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';

/**
 * Admin Service - Slimmed down to admin-specific functionality only
 * 
 * Domain CRUD operations have been moved to their respective modules:
 * - Hospitals: hospitalService (modules/hospitals/)
 * - Doctors: doctorService (modules/doctors/)
 * - Users/Patients: userService (modules/users/)
 * - Appointments: appointmentService (modules/appointments/)
 * - Payments: paymentService (modules/payments/)
 * - Refunds: refundService (modules/refunds/)
 * - Tickets/Support: supportService (modules/support/)
 * 
 * This service now only handles:
 * - Dashboard stats & analytics
 * - Hospital/Doctor verification workflows
 * - Audit logs
 * - System settings
 * - Reports
 */
class AdminService {
  private supabase = supabaseAdmin;
  private log = logger.child('AdminService');

  // =========================================================================
  // DASHBOARD & OVERVIEW
  // =========================================================================

  async getDashboardStats() {
    const [{ count: totalUsers }, { count: totalHospitals }, { count: totalDoctors }, { count: totalAppointments }] = await Promise.all([
      this.supabase.from('users').select('id', { count: 'exact' }),
      this.supabase.from('hospitals').select('id', { count: 'exact' }),
      this.supabase.from('doctors').select('id', { count: 'exact' }),
      this.supabase.from('appointments').select('id', { count: 'exact' }),
    ]);

    return {
      totalUsers: Number(totalUsers || 0),
      totalHospitals: Number(totalHospitals || 0),
      totalDoctors: Number(totalDoctors || 0),
      totalAppointments: Number(totalAppointments || 0),
    };
  }

  async getRevenue(_filters: any = {}) {
    const { data } = await this.supabase.from('payments').select('amount').eq('status', 'completed' as any);
    const total = (data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return { total, platformFees: 0, data: [] };
  }

  async getUserGrowth(filters: any = {}) {
    const { startDate, endDate, groupBy = 'day', role } = filters;
    return { total: 0, data: [] };
  }

  // =========================================================================
  // VERIFICATION WORKFLOWS (Hospital & Doctor)
  // =========================================================================

  // =========================================================================
  // LISTING & MANAGEMENT
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
      query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    // Handle Sorting
    const sortCol = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder === 'asc' ? { ascending: true } : { ascending: false };

    // Only apply native sorting for valid database columns
    const dbColumns = ['name', 'created_at', 'city', 'state', 'verification_status', 'type', 'is_active', 'email', 'phone'];
    if (dbColumns.includes(sortCol)) {
      query = query.order(sortCol, sortOrder);
    } else {
      // Default fallback
      query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list hospitals', error);
      throw new BadRequestError('Failed to list hospitals');
    }

    // Transform data to simplify counts for frontend
    const hospitals = (data || []).map((h: any) => ({
      ...h,
      doctorCount: h.doctors?.[0]?.count || 0,
      appointmentCount: h.appointments?.[0]?.count || 0
    }));

    // Optional: Secondary in-memory stable sort for non-DB columns (only affects current page)
    if (filters.sortBy === 'doctorCount') {
      hospitals.sort((a, b) => filters.sortOrder === 'asc' ? a.doctorCount - b.doctorCount : b.doctorCount - a.doctorCount);
    } else if (filters.sortBy === 'appointmentCount') {
      hospitals.sort((a, b) => filters.sortOrder === 'asc' ? a.appointmentCount - b.appointmentCount : b.appointmentCount - a.appointmentCount);
    }

    return {
      hospitals,
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    };
  }

  async deleteHospital(id: string) {
    const { error } = await this.supabase
      .from('hospitals')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async updateHospitalStatus(id: string, is_active: boolean) {
    const { error } = await this.supabase
      .from('hospitals')
      .update({ is_active })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

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

    if (filters.search) {
      // Basic search on doctor-specific fields
      query = query.or(`registration_number.ilike.%${filters.search}%,registration_council.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list doctors', error);
      throw new BadRequestError(`Failed to list doctors: ${error.message}`);
    }

    // Transform data to match frontend expectations
    // Note: Frontend uses properties like doctor.user.name or flattened doctor.name
    const transformedDoctors = (data || []).map((d: any) => ({
      ...d,
      name: d.user?.name,
      hospitalName: d.hospital?.name,
      specializationName: d.specialization?.name
    }));

    return {
      doctors: transformedDoctors,
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    };
  }

  async verifyHospital(hospitalId: string, payload: { status: 'verified' | 'rejected' | 'under_review'; remarks?: string }) {
    const update: any = {
      verification_status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.remarks) update.rejection_reason = payload.remarks;

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

  async requestDocuments(hospitalId: string, documentTypes: string[], message?: string) {
    try {
      await (this.supabase as any).from('hospital_verification_requests').insert({
        hospital_id: hospitalId,
        document_types: documentTypes,
        message,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // ignore if table doesn't exist
    }
    return { sent: true };
  }

  async listUsers(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list users', error);
      throw new BadRequestError('Failed to list users');
    }

    return {
      users: data || [],
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    };
  }

  async getUser(id: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*, family_members(*)')
      .eq('id', id)
      .single();

    if (error) {
      this.log.error('Failed to get user', error);
      throw new NotFoundError('User not found');
    }

    return data;
  }

  async updateUserStatus(id: string, is_active: boolean) {
    const { error } = await this.supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.log.error('Failed to update user status', error);
      throw new BadRequestError('Failed to update user status');
    }
    return true;
  }

  async deleteUser(id: string) {
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      this.log.error('Failed to delete user', error);
      throw new BadRequestError('Failed to delete user');
    }
    return true;
  }


  async verifyDoctor(doctorId: string, payload: { status: 'verified' | 'rejected' | 'under_review'; remarks?: string }) {
    const update: any = {
      verification_status: payload.status,
      updated_at: new Date().toISOString(),
    };
    if (payload.remarks) update.rejection_reason = payload.remarks;

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
      .update({ is_active })
      .eq('id', id);

    if (error) {
      this.log.error('Failed to update doctor status', error);
      throw new BadRequestError('Failed to update doctor status');
    }
    return true;
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

    return {
      logs: data || [],
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    };
  }

  async getAuditLog(id: string) {
    const { data, error } = await this.supabase.from('audit_logs').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundError('Audit log not found');
    return data;
  }

  // =========================================================================
  // SYSTEM SETTINGS
  // =========================================================================

  async getSettings() {
    const { data, error } = await this.supabase.from('system_settings').select('*');
    if (error) {
      this.log.error('Failed to fetch settings', error);
      throw new BadRequestError('Failed to fetch settings');
    }
    return data || [];
  }

  async getSetting(key: string) {
    const { data, error } = await this.supabase.from('system_settings').select('*').eq('key', key).single();
    if (error || !data) throw new NotFoundError('Setting not found');
    return data;
  }

  async updateSetting(key: string, value: any) {
    const { data, error } = await this.supabase
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to update setting', error);
      throw new BadRequestError('Failed to update setting');
    }
    return data;
  }

  async resetSetting(key: string) {
    const { data, error } = await this.supabase.from('system_settings').delete().eq('key', key);
    if (error) {
      this.log.error('Failed to reset setting', error);
      throw new BadRequestError('Failed to reset setting');
    }
    return { reset: true };
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  async generateReport(type: string, _filters: any = {}) {
    return { url: `/reports/${type}/download`, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  }

  async getScheduledReports() {
    try {
      const { data } = await this.supabase.from('scheduled_reports').select('*');
      return data || [];
    } catch (e) {
      return [];
    }
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  async getAnalyticsOverview() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalPatients },
      { count: totalDoctors },
      { count: totalHospitals },
      { count: totalAppointments },
      { count: weekAppointments },
      { count: newPatientsThisMonth },
    ] = await Promise.all([
      this.supabase.from('users').select('id', { count: 'exact' }).eq('role', 'patient'),
      this.supabase.from('doctors').select('id', { count: 'exact' }),
      this.supabase.from('hospitals').select('id', { count: 'exact' }),
      this.supabase.from('appointments').select('id', { count: 'exact' }),
      this.supabase.from('appointments').select('id', { count: 'exact' }).gte('scheduled_date', weekAgo),
      this.supabase.from('users').select('id', { count: 'exact' }).eq('role', 'patient').gte('created_at', monthStart),
    ]);

    const { data: completedPayments } = await this.supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed');

    const totalRevenue = (completedPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

    return {
      patients: { total: totalPatients || 0, newThisMonth: newPatientsThisMonth || 0 },
      doctors: { total: totalDoctors || 0 },
      hospitals: { total: totalHospitals || 0 },
      appointments: { total: totalAppointments || 0, thisWeek: weekAppointments || 0 },
      revenue: { total: totalRevenue },
    };
  }

  async getAppointmentTrends(period: 'day' | 'week' | 'month' = 'week') {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await this.supabase
      .from('appointments')
      .select('scheduled_date, status')
      .gte('scheduled_date', startDate.split('T')[0]);

    const byDate: Record<string, number> = {};
    (data || []).forEach((a: any) => {
      const dateKey = a.scheduled_date;
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }

  async getRevenueTrends(period: 'day' | 'week' | 'month' = 'week') {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await this.supabase
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', startDate);

    const byDate: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      const date = p.created_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + Number(p.amount || 0);
    });

    return Object.entries(byDate).map(([date, amount]) => ({ date, amount }));
  }

  async getUserTrends(period: 'day' | 'week' | 'month' = 'week') {
    const days = period === 'month' ? 30 : period === 'week' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await this.supabase
      .from('users')
      .select('created_at, role')
      .gte('created_at', startDate);

    const byDate: Record<string, number> = {};
    (data || []).forEach((u: any) => {
      const date = u.created_at.split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });

    return Object.entries(byDate).map(([date, count]) => ({ date, count }));
  }
}

export const adminService = new AdminService();

