// @ts-nocheck
import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import type { DoctorFilters, DoctorStats } from './doctor.types.js';
import type { Database } from '../../types/database.types.js';

type DoctorRow = Database['public']['Tables']['doctors']['Row'];

/**
 * Doctor Repository - Database operations for doctors
 */
class DoctorRepository {
  private logger = logger.child('DoctorRepository');
  private supabase = getSupabaseAdmin();

  /**
   * Find doctor by ID
   */
  async findById(id: string): Promise<DoctorRow | null> {
    const { data, error } = await this.supabase
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.debug(`Doctor not found: ${id}`);
      return null;
    }

    return data;
  }

  /**
   * Find doctor by ID with user and hospital info
   */
  async findByIdWithRelations(id: string) {
    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        users!doctors_user_id_fkey(id, full_name, phone, email, profile_picture_url),
        hospitals!doctors_hospital_id_fkey(id, name, slug, city, state, logo_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      this.logger.debug(`Doctor not found with relations: ${id}`);
      return null;
    }

    return data;
  }

  /**
   * Find doctor by user ID
   */
  async findByUserId(userId: string): Promise<DoctorRow | null> {
    const { data, error } = await this.supabase
      .from('doctors')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Find doctors with filters
   */
  async findMany(filters: DoctorFilters): Promise<{ doctors: any[]; total: number }> {
    let query = this.supabase
      .from('doctors')
      .select(`
        *,
        users!doctors_user_id_fkey(id, full_name, profile_picture_url),
        hospitals!doctors_hospital_id_fkey(id, name, city, state)
      `, { count: 'exact' });

    // Apply filters
    if (filters.hospitalId) {
      query = query.eq('hospital_id', filters.hospitalId);
    }

    if (filters.specialization) {
      query = query.ilike('specialization', `%${filters.specialization}%`);
    }

    if (filters.consultationType) {
      if (filters.consultationType === 'online') {
        query = query.in('consultation_types', ['online', 'both']);
      } else if (filters.consultationType === 'in_person') {
        query = query.in('consultation_types', ['in_person', 'both']);
      } else {
        query = query.eq('consultation_types', filters.consultationType);
      }
    }

    if (filters.minFee !== undefined) {
      query = query.or(`fee_in_person.gte.${filters.minFee},fee_online.gte.${filters.minFee}`);
    }

    if (filters.maxFee !== undefined) {
      query = query.or(`fee_in_person.lte.${filters.maxFee},fee_online.lte.${filters.maxFee}`);
    }

    if (filters.minExperience !== undefined) {
      query = query.gte('experience_years', filters.minExperience);
    }

    if (filters.minRating !== undefined) {
      query = query.gte('rating', filters.minRating);
    }

    if (filters.language) {
      query = query.contains('languages_spoken', [filters.language]);
    }

    if (filters.search) {
      // Search in specialization and qualification
      query = query.or(`specialization.ilike.%${filters.search}%,qualification.ilike.%${filters.search}%`);
    }

    // Only show active doctors
    query = query.eq('status', 'active');

    // Sorting
    const sortColumn = this.getSortColumn(filters.sortBy || 'rating');
    query = query.order(sortColumn, { ascending: filters.sortOrder !== 'desc', nullsFirst: false });

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch doctors', error);
      throw error;
    }

    return {
      doctors: data || [],
      total: count || 0,
    };
  }

  /**
   * Update doctor
   */
  async update(id: string, data: Database['public']['Tables']['doctors']['Update']): Promise<DoctorRow> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update doctor', error);
      throw error;
    }

    return doctor;
  }

  /**
   * Update doctor stats
   */
  async updateStats(id: string, stats: Partial<{
    total_appointments: number;
    rating: number;
    total_reviews: number;
  }>): Promise<void> {
    const { error } = await this.supabase
      .from('doctors')
      .update(stats)
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to update doctor stats', error);
    }
  }

  /**
   * Get doctor statistics
   */
  async getStats(doctorId: string, startDate?: string, endDate?: string): Promise<DoctorStats> {
    // Build date filter for appointments
    let appointmentQuery = this.supabase
      .from('appointments')
      .select('status, consultation_type', { count: 'exact' })
      .eq('doctor_id', doctorId);

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
      .eq('doctor_id', doctorId);

    // Get earnings (simplified - would need payouts table)
    const { data: consultations } = await this.supabase
      .from('consultations')
      .select('actual_duration')
      .eq('doctor_id', doctorId)
      .eq('status', 'completed');

    const averageConsultationTime = consultations && consultations.length > 0
      ? consultations.reduce((sum, c) => sum + (c.actual_duration || 0), 0) / consultations.length
      : 0;

    // Get doctor rating
    const { data: doctor } = await this.supabase
      .from('doctors')
      .select('rating, total_reviews')
      .eq('id', doctorId)
      .single();

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      totalPatients: patientCount || 0,
      totalEarnings: 0, // Would need payments query
      pendingPayout: 0, // Would need payouts table
      rating: doctor?.rating || null,
      totalReviews: doctor?.total_reviews || 0,
      averageConsultationTime: Math.round(averageConsultationTime),
    };
  }

  /**
   * Get doctor schedules
   */
  async getSchedules(doctorId: string) {
    const { data, error } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch doctor schedules', error);
      return [];
    }

    return data;
  }

  /**
   * Get schedule overrides for date range
   */
  async getScheduleOverrides(doctorId: string, startDate: string, endDate: string) {
    const { data, error } = await this.supabase
      .from('doctor_schedule_overrides')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      this.logger.error('Failed to fetch schedule overrides', error);
      return [];
    }

    return data;
  }

  /**
   * Get booked slots for date range
   */
  async getBookedSlots(doctorId: string, startDate: string, endDate: string) {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .eq('doctor_id', doctorId)
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .not('status', 'in', '(cancelled_by_patient,cancelled_by_doctor,cancelled_by_hospital,no_show)');

    if (error) {
      this.logger.error('Failed to fetch booked slots', error);
      return [];
    }

    return data;
  }

  /**
   * Get sort column name
   */
  private getSortColumn(sortBy: string): string {
    const sortMap: Record<string, string> = {
      name: 'qualification', // Will sort by qualification as proxy for name
      rating: 'rating',
      experience: 'experience_years',
      fee: 'fee_in_person',
      createdAt: 'created_at',
    };
    return sortMap[sortBy] || 'rating';
  }
}

// Export singleton instance
export const doctorRepository = new DoctorRepository();

