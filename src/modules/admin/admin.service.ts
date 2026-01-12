import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

class AdminService {
  private supabase = getSupabaseAdmin();
  private log = logger.child('AdminService');

  async getDashboardStats() {
    // Basic counts - extend as needed
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
    // Placeholder: implement real revenue aggregation later
    const { data } = await this.supabase.from('payments').select('amount').eq('status', 'paid');
    const total = (data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return { total, platformFees: 0, data: [] };
  }

  async listUsers(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query: any = this.supabase
      .from('users')
      .select('id, full_name, email, phone, role, is_active, is_blocked, created_at', { count: 'exact' });

    if (filters.search) {
      query = query.ilike('full_name', `%${filters.search}%`);
    }

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive === 'true' || filters.isActive === true);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.log.error('Failed to list users', error);
      throw new BadRequestError('Failed to list users');
    }

    return {
      users: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getUser(userId: string) {
    // First try embedding hospitals using the admin_user relation alias (explicit)
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*, hospitals!hospitals_admin_user_id_fkey(id, name)')
        .eq('id', userId)
        .single();

      if (error) {
        // If embedding failed due to ambiguous relationships, fall through to fallback logic
        this.log.warn('getUser supabase embed error (attempt 1)', { userId, error });
        throw error;
      }

      if (!data) {
        this.log.info('getUser no data for id (attempt 1)', { userId });
        throw new NotFoundError('User not found');
      }

      return data;
    } catch (err: any) {
      // If PostgREST complains about multiple relationships (PGRST201), perform a safer manual fetch
      if (err && err.code === 'PGRST201') {
        this.log.info('getUser falling back to manual queries due to ambiguous relationship', { userId, reason: err.message });

        // Fetch user without embedding
        const { data: userData, error: userError } = await this.supabase.from('users').select('*').eq('id', userId).single();
        if (userError || !userData) {
          this.log.warn('getUser user fetch failed in fallback', { userId, userError });
          throw new NotFoundError('User not found');
        }

        // Fetch hospitals where this user is admin or verifier (combine both relationships)
        const hospitals: any[] = [];
        try {
          const { data: h1 } = await this.supabase.from('hospitals').select('id, name').eq('admin_user_id', userId);
          if (h1) hospitals.push(...h1);
        } catch (e) {
          this.log.warn('getUser fallback fetch hospitals by admin_user_id failed', { userId, e });
        }

        try {
          const { data: h2 } = await this.supabase.from('hospitals').select('id, name').eq('verified_by', userId);
          if (h2) hospitals.push(...h2);
        } catch (e) {
          this.log.warn('getUser fallback fetch hospitals by verified_by failed', { userId, e });
        }

        // Deduplicate hospitals by id
        const seen = new Set();
        const uniqueHospitals = hospitals.filter((h) => {
          if (!h || !h.id) return false;
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        });

        // Attach hospitals under the same key the embedded select would have used
        return { ...userData, hospitals: uniqueHospitals };
      }

      this.log.warn('getUser supabase error', { userId, error: err });
      throw new NotFoundError('User not found');
    }
  }

  async updateUser(userId: string, payload: any) {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
    if (payload.isVerified !== undefined) updateData.is_verified = payload.isVerified;
    if (payload.role) updateData.role = payload.role;

    const { data, error } = await this.supabase.from('users').update(updateData).eq('id', userId).select().single();

    if (error) {
      this.log.error('Failed to update user', error);
      throw new BadRequestError('Failed to update user');
    }

    return data;
  }

  async deleteUser(userId: string) {
    const { data, error } = await this.supabase.from('users').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', userId).select().single();
    if (error) {
      this.log.error('Failed to delete (deactivate) user', error);
      throw new BadRequestError('Failed to delete user');
    }
    return data;
  }

  async banUser(userId: string, reason?: string, durationDays?: number) {
    const banExpiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;
    const { data, error } = await this.supabase
      .from('users')
      .update({ is_blocked: true, ban_reason: reason ?? null, ban_expires_at: banExpiresAt, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to ban user', error);
      throw new BadRequestError('Failed to ban user');
    }

    return data;
  }

  async unbanUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .update({ is_blocked: false, ban_reason: null, ban_expires_at: null, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to unban user', error);
      throw new BadRequestError('Failed to unban user');
    }

    return data;
  }

  async getUserGrowth(filters: any = {}) {
    // Simple growth by day placeholder
    const { startDate, endDate, groupBy = 'day', role } = filters;
    // For now, return empty structure — implement real aggregation later
    return { total: 0, data: [] };
  }

  async listPendingHospitalVerifications(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query: any = this.supabase
      .from('hospitals')
      .select('*', { count: 'exact' })
      .eq('verification_status', 'pending');

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.log.error('Failed to list pending hospitals', error);
      throw new BadRequestError('Failed to list hospitals');
    }

    return {
      hospitals: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async verifyHospital(hospitalId: string, payload: any) {
    const update: any = { updated_at: new Date().toISOString() };
    if (payload.status) update.verification_status = payload.status;
    if (payload.remarks) update.verification_remarks = payload.remarks;

    const { data, error } = await this.supabase.from('hospitals').update(update).eq('id', hospitalId).select().single();
    if (error) {
      this.log.error('Failed to verify hospital', error);
      throw new BadRequestError('Failed to verify hospital');
    }
    return data;
  }

  async requestDocuments(hospitalId: string, documentTypes: string[], message?: string) {
    // Store a simple request record in `hospital_verification_requests` if exists, else return success
    try {
      await this.supabase.from('hospital_verification_requests').insert({ hospital_id: hospitalId, document_types: documentTypes, message, created_at: new Date().toISOString() });
    } catch (e) {
      // ignore if table doesn't exist
    }
    return { sent: true };
  }

  async listTickets(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.log.error('Failed to list tickets', error);
      throw new BadRequestError('Failed to list tickets');
    }

    return {
      tickets: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getTicket(ticketId: string) {
    const { data, error } = await this.supabase.from('support_tickets').select('*').eq('id', ticketId).single();
    if (error || !data) {
      throw new NotFoundError('Ticket not found');
    }
    return data;
  }

  async updateTicket(ticketId: string, payload: any) {
    const { data, error } = await this.supabase.from('support_tickets').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', ticketId).select().single();
    if (error) {
      this.log.error('Failed to update ticket', error);
      throw new BadRequestError('Failed to update ticket');
    }
    return data;
  }

  async replyTicket(ticketId: string, message: string, attachments?: string[]) {
    // Append reply to `ticket_replies` if table present, else update thread in tickets
    try {
      await this.supabase.from('ticket_replies').insert({ ticket_id: ticketId, message, attachments: attachments || [], created_at: new Date().toISOString() });
    } catch (e) {
      // fallback: add to ticket.messages array if exists
      try {
        const { data } = await this.supabase.from('support_tickets').select('messages').eq('id', ticketId).single();
        const messages = (data?.messages || []).concat([{ message, attachments: attachments || [], created_at: new Date().toISOString() }]);
        await this.supabase.from('support_tickets').update({ messages, updated_at: new Date().toISOString() }).eq('id', ticketId);
      } catch (err) {
        this.log.warn('Failed to store reply in fallback', err);
      }
    }
    return this.getTicket(ticketId);
  }

  async closeTicket(ticketId: string, resolution?: string) {
    const { data, error } = await this.supabase.from('support_tickets').update({ status: 'closed', resolution: resolution ?? null, updated_at: new Date().toISOString() }).eq('id', ticketId).select().single();
    if (error) {
      this.log.error('Failed to close ticket', error);
      throw new BadRequestError('Failed to close ticket');
    }
    return data;
  }

  async listAuditLogs(filters: any = {}) {
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) {
      this.log.error('Failed to list audit logs', error);
      throw new BadRequestError('Failed to list audit logs');
    }
    return {
      logs: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  async getAuditLog(id: string) {
    const { data, error } = await this.supabase.from('audit_logs').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundError('Audit log not found');
    return data;
  }

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
    const { data, error } = await this.supabase.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() }).select().single();
    if (error) {
      this.log.error('Failed to update setting', error);
      throw new BadRequestError('Failed to update setting');
    }
    return data;
  }

  async resetSetting(key: string) {
    // Placeholder: remove override and return default if exists
    const { data, error } = await this.supabase.from('system_settings').delete().eq('key', key);
    if (error) {
      this.log.error('Failed to reset setting', error);
      throw new BadRequestError('Failed to reset setting');
    }
    return { reset: true };
  }

  async generateReport(type: string, _filters: any = {}) {
    // Placeholder: create a signed URL or job - return simple object
    return { url: `/reports/${type}/download`, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  }

  async getScheduledReports() {
    // Placeholder: return empty list or query `scheduled_reports` if exists
    try {
      const { data } = await this.supabase.from('scheduled_reports').select('*');
      return data || [];
    } catch (e) {
      return [];
    }
  }
}

export const adminService = new AdminService();
