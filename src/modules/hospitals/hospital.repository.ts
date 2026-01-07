// @ts-nocheck
import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import type { Hospital, HospitalListItem, HospitalFilters, HospitalStats } from './hospital.types.js';
import type { Database } from '../../types/database.types.js';

type HospitalRow = Database['public']['Tables']['hospitals']['Row'];

/**
 * Hospital Repository - Database operations for hospitals
 */
class HospitalRepository {
  private logger = logger.child('HospitalRepository');
  private supabase = getSupabaseAdmin();

  /**
   * Find hospital by ID
   */
  async findById(id: string): Promise<HospitalRow | null> {
    const { data, error } = await this.supabase
      .from('hospitals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.debug(`Hospital not found: ${id}`);
      return null;
    }

    return data;
  }

  /**
   * Find hospital by slug
   */
  async findBySlug(slug: string): Promise<HospitalRow | null> {
    const { data, error } = await this.supabase
      .from('hospitals')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      this.logger.debug(`Hospital not found by slug: ${slug}`);
      return null;
    }

    return data;
  }

  /**
   * Find hospital by user ID
   */
  async findByUserId(userId: string): Promise<HospitalRow | null> {
    const { data, error } = await this.supabase
      .from('hospitals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Find hospitals with filters
   */
  async findMany(filters: HospitalFilters): Promise<{ hospitals: HospitalRow[]; total: number }> {
    let query = this.supabase
      .from('hospitals')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }

    if (filters.state) {
      query = query.ilike('state', `%${filters.state}%`);
    }

    if (filters.specialty) {
      query = query.contains('specialties', [filters.specialty]);
    }

    if (filters.verified !== undefined) {
      if (filters.verified) {
        query = query.eq('verification_status', 'verified');
      }
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
    }

    // Only show active hospitals
    query = query.eq('is_active', true);

    // Sorting
    const sortColumn = this.getSortColumn(filters.sortBy || 'name');
    query = query.order(sortColumn, { ascending: filters.sortOrder !== 'desc' });

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch hospitals', error);
      throw error;
    }

    return {
      hospitals: data || [],
      total: count || 0,
    };
  }

  /**
   * Create a new hospital
   */
  async create(data: Database['public']['Tables']['hospitals']['Insert']): Promise<HospitalRow> {
    const { data: hospital, error } = await this.supabase
      .from('hospitals')
      .insert(data)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create hospital', error);
      throw error;
    }

    return hospital;
  }

  /**
   * Update hospital
   */
  async update(id: string, data: Database['public']['Tables']['hospitals']['Update']): Promise<HospitalRow> {
    const { data: hospital, error } = await this.supabase
      .from('hospitals')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update hospital', error);
      throw error;
    }

    return hospital;
  }

  /**
   * Update hospital stats
   */
  async updateStats(id: string, stats: Partial<{
    total_doctors: number;
    total_appointments: number;
    rating: number;
    total_reviews: number;
  }>): Promise<void> {
    const { error } = await this.supabase
      .from('hospitals')
      .update(stats)
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to update hospital stats', error);
    }
  }

  /**
   * Get hospital statistics
   */
  async getStats(hospitalId: string, startDate?: string, endDate?: string): Promise<HospitalStats> {
    // Get doctor count
    const { count: doctorCount } = await this.supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('status', 'active');

    // Build date filter
    let appointmentQuery = this.supabase
      .from('appointments')
      .select('status, payment_status', { count: 'exact' })
      .eq('hospital_id', hospitalId);

    if (startDate) {
      appointmentQuery = appointmentQuery.gte('appointment_date', startDate);
    }
    if (endDate) {
      appointmentQuery = appointmentQuery.lte('appointment_date', endDate);
    }

    const { data: appointments } = await appointmentQuery;

    // Calculate stats
    const totalAppointments = appointments?.length || 0;
    const completedAppointments = appointments?.filter(a => a.status === 'completed').length || 0;
    const cancelledAppointments = appointments?.filter(a => 
      ['cancelled_by_patient', 'cancelled_by_doctor', 'cancelled_by_hospital'].includes(a.status)
    ).length || 0;

    // Get unique patients
    const { count: patientCount } = await this.supabase
      .from('appointments')
      .select('patient_id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId);

    // Get revenue (simplified)
    const { data: payments } = await this.supabase
      .from('payments')
      .select('amount')
      .eq('hospital_id', hospitalId)
      .eq('status', 'captured');

    const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Get hospital rating
    const { data: hospital } = await this.supabase
      .from('hospitals')
      .select('rating, total_reviews')
      .eq('id', hospitalId)
      .single();

    return {
      totalDoctors: doctorCount || 0,
      totalPatients: patientCount || 0,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      totalRevenue,
      pendingPayouts: 0, // Would need payouts table query
      rating: hospital?.rating || null,
      totalReviews: hospital?.total_reviews || 0,
    };
  }

  /**
   * Get doctors for a hospital
   */
  async getDoctors(hospitalId: string) {
    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        id, specialization, qualification, experience_years, bio,
        fee_in_person, fee_online, status, rating, total_reviews,
        users!doctors_user_id_fkey(id, full_name, profile_picture_url)
      `)
      .eq('hospital_id', hospitalId)
      .eq('status', 'active');

    if (error) {
      this.logger.error('Failed to fetch hospital doctors', error);
      throw error;
    }

    return data;
  }

  /**
   * Get sort column name
   */
  private getSortColumn(sortBy: string): string {
    const sortMap: Record<string, string> = {
      name: 'name',
      rating: 'rating',
      totalDoctors: 'total_doctors',
      createdAt: 'created_at',
    };
    return sortMap[sortBy] || 'name';
  }
}

// Export singleton instance
export const hospitalRepository = new HospitalRepository();

