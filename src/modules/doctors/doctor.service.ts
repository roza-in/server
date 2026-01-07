import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../common/errors.js';
import type {
  Doctor,
  DoctorSchedule,
  ScheduleOverride,
  ConsultationType,
  DayOfWeek,
  VerificationStatus,
} from '../../types/database.types.js';
import type {
  DoctorProfile,
  DoctorFilters,
  DoctorListResponse,
  DoctorStats,
  DoctorDashboard,
  DoctorPublicProfile,
  DoctorDayAvailability,
  TimeSlot,
  ScheduleInput,
  ScheduleOverrideInput,
  UpdateDoctorInput,
  DoctorListItem,
} from './doctor.types.js';

const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Doctor Service - Production-ready business logic for doctors
 */
class DoctorService {
  private logger = logger.child('DoctorService');
  private supabase = getSupabaseAdmin();

  // =================================================================
  // Doctor CRUD Operations
  // =================================================================

  /**
   * Get doctor by ID
   */
  async getById(doctorId: string): Promise<DoctorProfile> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(id, full_name, phone, email, avatar_url, gender),
        hospital:hospitals!doctors_hospital_id_fkey(id, name, slug, hospital_type, address, logo_url),
        specialization:specializations(id, name, display_name, icon_url)
      `)
      .eq('id', doctorId)
      .single();

    if (error || !doctor) {
      throw new NotFoundError('Doctor not found');
    }

    return doctor as DoctorProfile;
  }

  /**
   * Get doctor by user ID
   */
  async getByUserId(userId: string): Promise<DoctorProfile> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(id, full_name, phone, email, avatar_url, gender),
        hospital:hospitals!doctors_hospital_id_fkey(id, name, slug, hospital_type, address, logo_url),
        specialization:specializations(id, name, display_name, icon_url)
      `)
      .eq('user_id', userId)
      .single();

    if (error || !doctor) {
      throw new NotFoundError('Doctor profile not found');
    }

    return doctor as DoctorProfile;
  }

  /**
   * Get doctor public profile
   */
  async getPublicProfile(doctorId: string): Promise<DoctorPublicProfile> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(full_name, avatar_url),
        hospital:hospitals!doctors_hospital_id_fkey(id, name, slug, logo_url, address),
        specialization:specializations(id, name, display_name, icon_url)
      `)
      .eq('id', doctorId)
      .eq('is_active', true)
      .single();

    if (error || !doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Get availability for next 7 days
    const availability = await this.getAvailability(doctorId, 7);

    const d = doctor as any;
    return {
      id: d.id,
      title: d.title,
      full_name: d.user?.full_name || '',
      avatar_url: d.user?.avatar_url,
      specialization: d.specialization,
      qualifications: d.qualifications,
      experience_years: d.experience_years,
      bio: d.bio,
      languages_spoken: d.languages_spoken,
      consultation_fee_online: d.consultation_fee_online,
      consultation_fee_in_person: d.consultation_fee_in_person,
      consultation_fee_walk_in: d.consultation_fee_walk_in,
      consultation_duration: d.consultation_duration,
      accepts_online: d.accepts_online,
      accepts_in_person: d.accepts_in_person,
      accepts_walk_in: d.accepts_walk_in,
      rating: d.rating,
      total_ratings: d.total_ratings,
      hospital: d.hospital,
      availability,
    };
  }

  /**
   * List doctors with filters
   */
  async list(filters: DoctorFilters): Promise<DoctorListResponse> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(full_name, avatar_url),
        hospital:hospitals!doctors_hospital_id_fkey(name, address),
        specialization:specializations(display_name)
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('verification_status', 'verified');

    // Apply filters
    if (filters.search) {
      // Search in user's full_name via a different approach
      query = query.or(`bio.ilike.%${filters.search}%`);
    }
    if (filters.hospital_id) {
      query = query.eq('hospital_id', filters.hospital_id);
    }
    if (filters.specialization_id) {
      query = query.eq('specialization_id', filters.specialization_id);
    }
    if (filters.accepts_online !== undefined) {
      query = query.eq('accepts_online', filters.accepts_online);
    }
    if (filters.accepts_in_person !== undefined) {
      query = query.eq('accepts_in_person', filters.accepts_in_person);
    }
    if (filters.min_experience) {
      query = query.gte('experience_years', filters.min_experience);
    }
    if (filters.max_fee) {
      query = query.lte('consultation_fee_in_person', filters.max_fee);
    }
    if (filters.min_rating) {
      query = query.gte('rating', filters.min_rating);
    }
    if (filters.language) {
      query = query.contains('languages_spoken', [filters.language]);
    }

    // Sorting
    const sortBy = filters.sort_by || 'rating';
    const sortOrder = filters.sort_order === 'asc';
    
    switch (sortBy) {
      case 'experience':
        query = query.order('experience_years', { ascending: sortOrder });
        break;
      case 'fee':
        query = query.order('consultation_fee_in_person', { ascending: sortOrder });
        break;
      case 'consultations':
        query = query.order('total_consultations', { ascending: sortOrder });
        break;
      case 'rating':
      default:
        query = query.order('rating', { ascending: sortOrder, nullsFirst: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch doctors', error);
      throw new BadRequestError('Failed to fetch doctors');
    }

    const total = count || 0;
    const doctors = (data || []).map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      hospital_id: d.hospital_id,
      full_name: d.user?.full_name,
      avatar_url: d.user?.avatar_url,
      title: d.title,
      specialization_id: d.specialization_id,
      specialization_name: d.specialization?.display_name,
      qualifications: d.qualifications,
      experience_years: d.experience_years,
      consultation_fee_online: d.consultation_fee_online,
      consultation_fee_in_person: d.consultation_fee_in_person,
      accepts_online: d.accepts_online,
      accepts_in_person: d.accepts_in_person,
      accepts_walk_in: d.accepts_walk_in,
      rating: d.rating,
      total_ratings: d.total_ratings,
      total_consultations: d.total_consultations,
      verification_status: d.verification_status,
      is_active: d.is_active,
      hospital_name: d.hospital?.name,
      hospital_city: d.hospital?.address?.city,
    })) as DoctorListItem[];

    return {
      doctors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    };
  }

  /**
   * Update doctor profile
   */
  async update(
    doctorId: string,
    userId: string,
    data: UpdateDoctorInput
  ): Promise<DoctorProfile> {
    const doctor = await this.getById(doctorId);
    
    // Check permission (doctor themselves or hospital admin)
    if (doctor.user_id !== userId) {
      // Check if user is hospital admin
      if (doctor.hospital_id) {
        const { data: hospital } = await this.supabase
          .from('hospitals')
          .select('admin_user_id')
          .eq('id', doctor.hospital_id)
          .single();
        
        if (!hospital || hospital.admin_user_id !== userId) {
          throw new ForbiddenError('Access denied');
        }
      } else {
        throw new ForbiddenError('Access denied');
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'title', 'specialization_id', 'qualifications', 'experience_years',
      'bio', 'languages_spoken', 'consultation_fee_online', 'consultation_fee_in_person',
      'consultation_fee_walk_in', 'consultation_duration', 'accepts_online',
      'accepts_in_person', 'accepts_walk_in', 'max_appointments_per_day',
      'signature_url', 'stamp_url'
    ];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        updateData[field] = (data as any)[field];
      }
    }

    const { data: updated, error } = await this.supabase
      .from('doctors')
      .update(updateData)
      .eq('id', doctorId)
      .select()
      .single();

    if (error || !updated) {
      throw new BadRequestError('Failed to update doctor profile');
    }

    return this.getById(doctorId);
  }

  // =================================================================
  // Schedule Management
  // =================================================================

  /**
   * Get doctor schedules
   */
  async getSchedules(doctorId: string): Promise<DoctorSchedule[]> {
    const { data, error } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('day_of_week');

    if (error) {
      throw new BadRequestError('Failed to fetch schedules');
    }

    return data || [];
  }

  /**
   * Set doctor schedule for a day
   */
  async setSchedule(
    doctorId: string,
    userId: string,
    schedule: ScheduleInput
  ): Promise<DoctorSchedule> {
    const doctor = await this.getById(doctorId);
    if (doctor.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // Upsert schedule
    const { data, error } = await this.supabase
      .from('doctor_schedules')
      .upsert({
        doctor_id: doctorId,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        slot_duration: schedule.slot_duration || 15,
        buffer_time: schedule.buffer_time || 5,
        break_start: schedule.break_start || null,
        break_end: schedule.break_end || null,
        max_patients_per_slot: schedule.max_patients_per_slot || 1,
        consultation_types: schedule.consultation_types || ['online', 'in_person'],
        is_active: schedule.is_active ?? true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'doctor_id,day_of_week',
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error('Failed to set schedule', error);
      throw new BadRequestError('Failed to set schedule');
    }

    return data;
  }

  /**
   * Set multiple schedules at once
   */
  async setSchedules(
    doctorId: string,
    userId: string,
    schedules: ScheduleInput[]
  ): Promise<DoctorSchedule[]> {
    const doctor = await this.getById(doctorId);
    if (doctor.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const scheduleData = schedules.map(s => ({
      doctor_id: doctorId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration: s.slot_duration || 15,
      buffer_time: s.buffer_time || 5,
      break_start: s.break_start || null,
      break_end: s.break_end || null,
      max_patients_per_slot: s.max_patients_per_slot || 1,
      consultation_types: s.consultation_types || ['online', 'in_person'],
      is_active: s.is_active ?? true,
    }));

    const { data, error } = await this.supabase
      .from('doctor_schedules')
      .upsert(scheduleData, { onConflict: 'doctor_id,day_of_week' })
      .select();

    if (error) {
      throw new BadRequestError('Failed to set schedules');
    }

    return data || [];
  }

  /**
   * Add schedule override (for specific dates)
   */
  async addScheduleOverride(
    doctorId: string,
    userId: string,
    override: ScheduleOverrideInput
  ): Promise<ScheduleOverride> {
    const doctor = await this.getById(doctorId);
    if (doctor.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const { data, error } = await this.supabase
      .from('schedule_overrides')
      .upsert({
        doctor_id: doctorId,
        override_date: override.override_date,
        is_available: override.is_available,
        reason: override.reason || null,
        custom_start_time: override.custom_start_time || null,
        custom_end_time: override.custom_end_time || null,
        custom_slot_duration: override.custom_slot_duration || null,
      }, {
        onConflict: 'doctor_id,override_date',
      })
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to add schedule override');
    }

    return data;
  }

  /**
   * Get doctor availability for N days
   */
  async getAvailability(doctorId: string, days: number = 7): Promise<DoctorDayAvailability[]> {
    // Get schedules
    const schedules = await this.getSchedules(doctorId);

    // Get overrides for the date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data: overrides } = await this.supabase
      .from('schedule_overrides')
      .select('*')
      .eq('doctor_id', doctorId)
      .gte('override_date', startDate.toISOString().split('T')[0])
      .lte('override_date', endDate.toISOString().split('T')[0]);

    // Get booked appointments
    const { data: appointments } = await this.supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .eq('doctor_id', doctorId)
      .gte('appointment_date', startDate.toISOString().split('T')[0])
      .lte('appointment_date', endDate.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked_in', 'in_progress']);

    const availability: DoctorDayAvailability[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1];

      // Check for override
      const override = overrides?.find(o => o.override_date === dateStr);
      
      // Get schedule for this day
      const schedule = schedules.find(s => s.day_of_week === dayOfWeek && s.is_active);

      let isAvailable = false;
      let slots: TimeSlot[] = [];

      if (override) {
        isAvailable = override.is_available;
        if (isAvailable && override.custom_start_time && override.custom_end_time) {
          slots = this.generateSlots(
            override.custom_start_time,
            override.custom_end_time,
            override.custom_slot_duration || schedule?.slot_duration || 15,
            schedule?.consultation_types || ['online', 'in_person'],
            appointments?.filter(a => a.appointment_date === dateStr) || []
          );
        }
      } else if (schedule) {
        isAvailable = true;
        slots = this.generateSlots(
          schedule.start_time,
          schedule.end_time,
          schedule.slot_duration,
          schedule.consultation_types || ['online', 'in_person'],
          appointments?.filter(a => a.appointment_date === dateStr) || [],
          schedule.break_start,
          schedule.break_end,
          schedule.max_patients_per_slot
        );
      }

      availability.push({
        date: dateStr,
        day_of_week: dayOfWeek,
        is_available: isAvailable,
        slots,
        override: override || undefined,
      });
    }

    return availability;
  }

  /**
   * Generate time slots for a day
   */
  private generateSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
    consultationTypes: ConsultationType[],
    bookedAppointments: any[],
    breakStart?: string | null,
    breakEnd?: string | null,
    maxCapacity: number = 1
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    const breakStartMinutes = breakStart ? 
      parseInt(breakStart.split(':')[0]) * 60 + parseInt(breakStart.split(':')[1]) : null;
    const breakEndMinutes = breakEnd ? 
      parseInt(breakEnd.split(':')[0]) * 60 + parseInt(breakEnd.split(':')[1]) : null;

    while (currentMinutes + slotDuration <= endMinutes) {
      // Skip if in break time
      if (breakStartMinutes && breakEndMinutes) {
        if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
          currentMinutes = breakEndMinutes;
          continue;
        }
      }

      const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
      const slotEnd = `${String(Math.floor((currentMinutes + slotDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + slotDuration) % 60).padStart(2, '0')}`;

      // Count booked appointments for this slot
      const bookedCount = bookedAppointments.filter(a => a.start_time === slotStart).length;

      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
        consultation_types: consultationTypes,
        is_available: bookedCount < maxCapacity,
        is_booked: bookedCount >= maxCapacity,
        remaining_capacity: Math.max(0, maxCapacity - bookedCount),
        max_capacity: maxCapacity,
      });

      currentMinutes += slotDuration;
    }

    return slots;
  }

  // =================================================================
  // Dashboard & Stats
  // =================================================================

  /**
   * Get doctor dashboard
   */
  async getDashboard(doctorId: string, userId: string): Promise<DoctorDashboard> {
    const doctor = await this.getById(doctorId);
    if (doctor.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const [stats, todaySchedule, upcomingAppointments] = await Promise.all([
      this.getStats(doctorId),
      this.getTodaySchedule(doctorId),
      this.getUpcomingAppointments(doctorId),
    ]);

    return {
      doctor,
      stats,
      todaySchedule,
      upcomingAppointments,
      recentPatients: [],
    };
  }

  /**
   * Get doctor statistics
   */
  async getStats(doctorId: string): Promise<DoctorStats> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

    const { count: totalAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId);

    const { count: completedAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('status', 'completed');

    const { count: todayAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('appointment_date', today);

    const { data: doctorData } = await this.supabase
      .from('doctors')
      .select('rating, total_ratings, total_consultations')
      .eq('id', doctorId)
      .single();

    const { data: earnings } = await this.supabase
      .from('payments')
      .select('doctor_payout')
      .eq('doctor_id', doctorId)
      .eq('status', 'completed');

    const totalEarnings = earnings?.reduce((sum, p) => sum + (p.doctor_payout || 0), 0) || 0;

    return {
      totalPatients: 0,
      totalAppointments: totalAppointments || 0,
      completedAppointments: completedAppointments || 0,
      cancelledAppointments: 0,
      todayAppointments: todayAppointments || 0,
      upcomingAppointments: 0,
      totalEarnings,
      monthlyEarnings: 0,
      pendingPayouts: 0,
      rating: doctorData?.rating || null,
      totalRatings: doctorData?.total_ratings || 0,
      averageConsultationTime: 15,
    };
  }

  /**
   * Get today's schedule
   */
  private async getTodaySchedule(doctorId: string): Promise<DoctorDayAvailability> {
    const availability = await this.getAvailability(doctorId, 1);
    return availability[0];
  }

  /**
   * Get upcoming appointments
   */
  private async getUpcomingAppointments(doctorId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await this.supabase
      .from('appointments')
      .select(`
        id,
        booking_id,
        appointment_date,
        start_time,
        consultation_type,
        status,
        symptoms,
        patient:users!appointments_patient_id_fkey(full_name, avatar_url)
      `)
      .eq('doctor_id', doctorId)
      .gte('appointment_date', today)
      .in('status', ['confirmed', 'checked_in'])
      .order('appointment_date')
      .order('start_time')
      .limit(10);

    return (data || []).map((a: any) => ({
      id: a.id,
      booking_id: a.booking_id,
      patient_name: a.patient?.full_name || 'Unknown',
      patient_avatar: a.patient?.avatar_url,
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      consultation_type: a.consultation_type,
      status: a.status,
      symptoms: a.symptoms,
    }));
  }

  // =================================================================
  // Verification (Admin)
  // =================================================================

  /**
   * Update doctor verification status (admin only)
   */
  async updateVerification(
    doctorId: string,
    status: VerificationStatus,
    notes?: string
  ): Promise<DoctorProfile> {
    const { data, error } = await this.supabase
      .from('doctors')
      .update({
        verification_status: status,
        verification_notes: notes || null,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doctorId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update verification status');
    }

    return this.getById(doctorId);
  }

  /**
   * Get doctors pending verification (admin)
   */
  async getPendingVerifications() {
    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(full_name, email, phone),
        hospital:hospitals!doctors_hospital_id_fkey(name)
      `)
      .eq('verification_status', 'pending')
      .order('created_at');

    if (error) {
      throw new BadRequestError('Failed to fetch pending verifications');
    }

    return data || [];
  }
}

// Export singleton instance
export const doctorService = new DoctorService();
