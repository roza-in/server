// @ts-nocheck
import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import type { AppointmentFilters, AppointmentStatus } from './appointment.types.js';
import type { Appointment } from '../../types/database.js';

type AppointmentRow = Appointment;

/**
 * Appointment Repository - Database operations for appointments
 */
class AppointmentRepository {
  private logger = logger.child('AppointmentRepository');
  private supabase = getSupabaseAdmin();

  /**
   * Find appointment by ID
   */
  async findById(id: string): Promise<AppointmentRow | null> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.debug(`Appointment not found: ${id}`);
      return null;
    }

    return data;
  }

  /**
   * Find appointment by ID with relations
   */
  async findByIdWithRelations(id: string) {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(
          id, full_name, phone, email, profile_picture_url, gender, date_of_birth
        ),
        doctor:doctors!appointments_doctor_id_fkey(
          id, user_id, specialization, qualification,
          users!doctors_user_id_fkey(id, full_name, profile_picture_url)
        ),
        hospital:hospitals!appointments_hospital_id_fkey(
          id, name, slug, city, address_line1, address_line2
        ),
        prescriptions(id, diagnosis, medications)
      `)
      .eq('id', id)
      .single();

    if (error) {
      this.logger.debug(`Appointment not found with relations: ${id}`);
      return null;
    }

    return data;
  }

  /**
   * Find appointments with filters
   */
  async findMany(filters: AppointmentFilters): Promise<{ appointments: any[]; total: number }> {
    let query = this.supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(id, full_name),
        doctor:doctors!appointments_doctor_id_fkey(
          id,
          users!doctors_user_id_fkey(id, full_name)
        ),
        hospital:hospitals!appointments_hospital_id_fkey(id, name)
      `, { count: 'exact' });

    // Apply filters
    if (filters.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }

    if (filters.doctorId) {
      query = query.eq('doctor_id', filters.doctorId);
    }

    if (filters.hospitalId) {
      query = query.eq('hospital_id', filters.hospitalId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.consultationType) {
      query = query.eq('consultation_type', filters.consultationType);
    }

    if (filters.startDate) {
      query = query.gte('appointment_date', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('appointment_date', filters.endDate);
    }

    if (filters.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    // Sorting
    const sortColumn = filters.sortBy === 'appointmentDate' ? 'appointment_date' : 'created_at';
    query = query.order(sortColumn, { ascending: filters.sortOrder !== 'desc' });

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch appointments', error);
      throw error;
    }

    return {
      appointments: data || [],
      total: count || 0,
    };
  }

  /**
   * Create a new appointment
   */
  async create(data: Database['public']['Tables']['appointments']['Insert']): Promise<AppointmentRow> {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .insert(data)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create appointment', error);
      throw error;
    }

    return appointment;
  }

  /**
   * Update appointment
   */
  async update(id: string, data: Database['public']['Tables']['appointments']['Update']): Promise<AppointmentRow> {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update appointment', error);
      throw error;
    }

    return appointment;
  }

  /**
   * Check if slot is already booked
   */
  async isSlotBooked(doctorId: string, date: string, startTime: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .eq('start_time', startTime)
      .not('status', 'in', '(cancelled_by_patient,cancelled_by_doctor,cancelled_by_hospital,no_show,rescheduled)');

    return (count || 0) > 0;
  }

  /**
   * Get patient's today appointments
   */
  async getPatientTodayAppointments(patientId: string, today: string) {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, end_time, status, consultation_type,
        doctor:doctors!appointments_doctor_id_fkey(
          id,
          users!doctors_user_id_fkey(full_name)
        ),
        hospital:hospitals!appointments_hospital_id_fkey(id, name)
      `)
      .eq('patient_id', patientId)
      .eq('appointment_date', today)
      .not('status', 'in', '(cancelled_by_patient,cancelled_by_doctor,cancelled_by_hospital)');

    if (error) {
      this.logger.error('Failed to fetch patient today appointments', error);
      return [];
    }

    return data;
  }

  /**
   * Get doctor's today appointments
   */
  async getDoctorTodayAppointments(doctorId: string, today: string) {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, end_time, status, consultation_type, symptoms,
        patient:users!appointments_patient_id_fkey(id, full_name, phone, gender, date_of_birth)
      `)
      .eq('doctor_id', doctorId)
      .eq('appointment_date', today)
      .not('status', 'in', '(cancelled_by_patient,cancelled_by_doctor,cancelled_by_hospital)')
      .order('start_time', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch doctor today appointments', error);
      return [];
    }

    return data;
  }

  /**
   * Get hospital's today appointments
   */
  async getHospitalTodayAppointments(hospitalId: string, today: string) {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, end_time, status, consultation_type,
        patient:users!appointments_patient_id_fkey(id, full_name, phone),
        doctor:doctors!appointments_doctor_id_fkey(
          id,
          users!doctors_user_id_fkey(full_name)
        )
      `)
      .eq('hospital_id', hospitalId)
      .eq('appointment_date', today)
      .not('status', 'in', '(cancelled_by_patient,cancelled_by_doctor,cancelled_by_hospital)')
      .order('start_time', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch hospital today appointments', error);
      return [];
    }

    return data;
  }
}

// Export singleton instance
export const appointmentRepository = new AppointmentRepository();

