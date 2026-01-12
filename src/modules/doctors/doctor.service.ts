import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors.js';
import type { DoctorSchedule, ScheduleOverride, ConsultationType, DayOfWeek, VerificationStatus } from '../../types/database.types.js';
import type { DoctorProfile, DoctorFilters, DoctorListResponse, DoctorStats, DoctorDashboard, DoctorPublicProfile, DoctorDayAvailability, TimeSlot, ScheduleInput, ScheduleOverrideInput, UpdateDoctorInput, DoctorListItem } from './doctor.types.js';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type DayName = typeof DAY_NAMES[number];

function normalizeDayOfWeek(v: any): DayName {
  if (typeof v === 'number') {
    const idx = Number(v);
    return DAY_NAMES[idx] as DayName;
  }
  if (typeof v === 'string') {
    return v as DayName;
  }
  throw new BadRequestError('Invalid day_of_week value');
}

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
   * Add a new doctor
   */
  async add(data: Partial<UpdateDoctorInput>, userId: string): Promise<DoctorProfile> {
    // Only hospitals may create doctor profiles via this endpoint.
    const { data: callerUser } = await this.supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (!callerUser) throw new BadRequestError('Requesting user not found');
    if (callerUser.role !== 'hospital') {
      throw new ForbiddenError('Only hospitals may create doctor profiles');
    }

    // Resolve hospital id for this hospital admin user
    const { data: hosp } = await this.supabase
      .from('hospitals')
      .select('id')
      .eq('admin_user_id', userId)
      .limit(1)
      .single();

    const hospitalId = hosp?.id;
    if (!hospitalId) throw new BadRequestError('Hospital not found for requesting user');

    // Create or promote the user record that will be linked to the doctor
    let doctorUserId: string | null = null;
    let createdUserId: string | null = null; // track if we created the user so we can rollback on failure

    // If explicit user_id provided, promote that user to doctor if needed
    if ((data as any).user_id) {
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id, role')
        .eq('id', (data as any).user_id)
        .single();

      if (!existingUser) throw new BadRequestError('Provided user_id not found');

      if (existingUser.role !== 'doctor') {
        await this.supabase
          .from('users')
          .update({ role: 'doctor', full_name: (data as any).full_name || (data as any).fullName, email: (data as any).email || null })
          .eq('id', existingUser.id);
      }

      doctorUserId = existingUser.id;
    } else if ((data as any).phone) {
      // If phone provided, find or create user by phone
      const phoneVal = String((data as any).phone).trim();
      if (!/^[+0-9]{7,15}$/.test(phoneVal)) {
        throw new BadRequestError('Invalid phone format');
      }
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id, role')
        .eq('phone', phoneVal)
        .single();

      if (existingUser) {
        if (existingUser.role !== 'doctor') {
          const { error: promoteErr } = await this.supabase
            .from('users')
            .update({ role: 'doctor', full_name: (data as any).full_name || (data as any).fullName, email: (data as any).email || null })
            .eq('id', existingUser.id);
          if (promoteErr) {
            this.logger.error('Failed to promote user to doctor', promoteErr);
            throw new BadRequestError('Failed to promote existing user to doctor', { dbError: promoteErr?.message || promoteErr });
          }
        }
        doctorUserId = existingUser.id;
      } else {
        // Create a random password hash to satisfy DB constraints (some deployments require password_hash non-null)
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        const { data: newUser, error: userError } = await this.supabase
          .from('users')
          .insert({
            phone: phoneVal,
            full_name: (data as any).full_name || (data as any).fullName || null,
            email: (data as any).email || null,
            role: 'doctor',
            is_active: true,
            password_hash: passwordHash,
          })
          .select()
          .single();

        if (userError || !newUser) {
          this.logger.error('Failed to create doctor user', userError);
          throw new BadRequestError('Failed to create doctor user', { dbError: userError?.message || userError });
        }

        doctorUserId = (newUser as any).id;
        createdUserId = doctorUserId;
      }
    } else {
      throw new BadRequestError('Provide phone or user_id to create doctor');
    }

    // Build insert payload following migrations
    const insertData: any = {
      user_id: doctorUserId,
      hospital_id: (data as any).hospital_id || hospitalId || null,
      registration_number: (data as any).registrationNumber || (data as any).medicalRegistrationNumber || null,
      registration_council: (data as any).registrationCouncil || null,
      license_number: (data as any).licenseNumber || null,
      specialization_id: (data as any).specialization_id || (data as any).specializationId || null,
      specialization: (data as any).specialization || null,
      sub_specializations: (data as any).sub_specializations || (data as any).subSpecializations || null,
      qualifications: (data as any).qualifications || null,
      years_of_experience: (data as any).experienceYears || (data as any).yearsOfExperience || 0,
      bio: (data as any).bio || null,
      consultation_fee: (data as any).consultationFeeInPerson || (data as any).consultation_fee || 0,
      online_consultation_fee: (data as any).consultationFeeOnline || (data as any).online_consultation_fee || 0,
      follow_up_fee: (data as any).consultationFeeWalkIn || (data as any).follow_up_fee || null,
      consultation_duration: (data as any).consultation_duration || (data as any).consultationDuration || 15,
      buffer_time: (data as any).buffer_time || (data as any).bufferTime || 5,
      max_patients_per_day: (data as any).max_appointments_per_day || (data as any).maxAppointmentsPerDay || null,
      languages: (data as any).languages_spoken || (data as any).languages || ['English', 'Hindi'],
      profile_image_url: (data as any).profile_image_url || (data as any).profileImageUrl || null,
      signature_url: (data as any).signature_url || (data as any).signatureUrl || null,
      verification_status: 'pending',
      is_verified: false,
      is_active: false,
    };

    // If specialization_id provided but specialization text missing,
    // try to resolve the display name from `specializations` table
    if (insertData.specialization_id && !insertData.specialization) {
      try {
        const { data: spec } = await this.supabase
          .from('specializations')
          .select('display_name, name')
          .eq('id', insertData.specialization_id)
          .limit(1)
          .single();

        if (spec) {
          insertData.specialization = spec.display_name || spec.name || 'General';
        }
      } catch (e) {
        this.logger.warn('Failed to resolve specialization display name', e);
      }
    }

    // Insert doctor record with rollback on failure (delete created user if doctor insert fails)
    try {
      const { data: doctor, error } = await this.supabase
        .from('doctors')
        .insert(insertData)
        .select()
        .single();

      if (error || !doctor) {
        this.logger.error('Error adding doctor:', error);
        throw new BadRequestError('Failed to add doctor', { dbError: error?.message || error });
      }

      return doctor as DoctorProfile;
    } catch (err) {
      this.logger.error('Doctor insert failed, rolling back user if needed', err);
      if (createdUserId) {
        try {
          await this.supabase.from('users').delete().eq('id', createdUserId);
          this.logger.info(`Rolled back created user ${createdUserId}`);
        } catch (delErr) {
          this.logger.error('Failed to rollback created user', delErr);
        }
      }
      const originalMessage = err instanceof Error ? err.message : String(err);
      throw new BadRequestError('Failed to add doctor', { originalError: originalMessage, rolledBackUserId: createdUserId || undefined });
    }
  }

  /**
   * Get doctor by ID
   */
  async getById(doctorId: string): Promise<DoctorProfile> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(*),
        hospital:hospitals!doctors_hospital_id_fkey(*),
        specialization:specializations(*)
      `)
      .eq('id', doctorId)
      .single();

    if (error) {
      this.logger.error('getById query error', error);
      throw new NotFoundError('Doctor not found');
    }

    if (!doctor) {
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
        user:users!doctors_user_id_fkey(*),
        hospital:hospitals!doctors_hospital_id_fkey(*),
        specialization:specializations(*)
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      this.logger.error('getByUserId query error', error);
      throw new NotFoundError('Doctor profile not found');
    }

    if (!doctor) {
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
        user:users!doctors_user_id_fkey(*),
        hospital:hospitals!doctors_hospital_id_fkey(*),
        specialization:specializations(*)
      `)
      .eq('id', doctorId)
      .eq('is_active', true)
      .single();

    if (error) {
      this.logger.error('getPublicProfile query error', error);
      throw new NotFoundError('Doctor not found');
    }

    if (!doctor) {
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

    let query: any = this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(full_name, avatar_url),
        hospital:hospitals!doctors_hospital_id_fkey(name, city, state),
        specialization:specializations(display_name)
      `, { count: 'exact' });

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
      hospital_city: d.hospital?.city,
      hospital_state: d.hospital?.state,
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
      'accepts_in_person', 'accepts_walk_in', 'max_patients_per_day',
      'registration_number', 'registration_council', 'license_number',
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

  /**
   * Update simple doctor status (active/inactive/suspended)
   */
  async updateStatus(
    doctorId: string,
    userId: string,
    role: string,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string
  ): Promise<DoctorProfile> {
    const doctor = await this.getById(doctorId);

    // Only hospital admin for the doctor's hospital or platform admin may change status
    if (role === 'hospital') {
      // hospital object returned by getById may not include admin_user_id; fetch hospital admin explicitly
      if (!doctor.hospital_id) {
        throw new ForbiddenError('Access denied');
      }
      const { data: hospital } = await this.supabase
        .from('hospitals')
        .select('admin_user_id')
        .eq('id', doctor.hospital_id)
        .single();
      if (!hospital || hospital.admin_user_id !== userId) {
        throw new ForbiddenError('Access denied');
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
      is_active: status === 'active',
    };

    // If suspended, mark verification_status accordingly (best-effort)
    if (status === 'suspended') {
      updateData.verification_status = 'suspended';
    }

    try {
      const { data: updated, error } = await this.supabase
        .from('doctors')
        .update(updateData)
        .eq('id', doctorId)
        .select()
        .single();

      if (error || !updated) {
        this.logger.error('Failed to update doctor status', error);
        throw new BadRequestError('Failed to update doctor status');
      }

      return this.getById(doctorId);
    } catch (e) {
      this.logger.error('updateStatus error', e);
      throw new BadRequestError('Failed to update doctor status');
    }
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

    return (data || []) as DoctorSchedule[];
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
        day_of_week: normalizeDayOfWeek((schedule as any).day_of_week),
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        slot_duration: schedule.slot_duration || 15,
        buffer_time: schedule.buffer_time || 5,
        break_start: schedule.break_start || null,
        break_end: schedule.break_end || null,
        max_appointments: schedule.max_patients_per_slot || 1,
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

    return data as DoctorSchedule;
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
      day_of_week: normalizeDayOfWeek((s as any).day_of_week),
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration: s.slot_duration || 15,
      buffer_time: s.buffer_time || 5,
      break_start: s.break_start || null,
      break_end: s.break_end || null,
      // DB column is `max_appointments`
      max_appointments: s.max_patients_per_slot || 1,
      consultation_types: s.consultation_types || ['online', 'in_person'],
      is_active: s.is_active ?? true,
    }));

    const { data, error } = await this.supabase
      .from('doctor_schedules')
      .upsert(scheduleData as any, { onConflict: 'doctor_id,day_of_week' })
      .select();

    if (error) {
      throw new BadRequestError('Failed to set schedules');
    }

    return (data as DoctorSchedule[]) || [];
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
        // DB columns are start_time/end_time/slot_duration
        start_time: override.custom_start_time || null,
        end_time: override.custom_end_time || null,
        slot_duration: override.custom_slot_duration || null,
      }, {
        onConflict: 'doctor_id,override_date',
      })
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to add schedule override');
    }

    return data as ScheduleOverride;
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

    const overridesTyped = (overrides || []) as ScheduleOverride[];

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
      const dayOfWeek = DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1];
      const dayIndex = (DAY_NAMES.indexOf(dayOfWeek as any) || 0) as DayOfWeek;

      // Check for override
      const override = overridesTyped.find(o => o.override_date === dateStr);
      
      // Get schedule for this day
      const schedule = schedules.find(s => s.day_of_week === dayOfWeek && s.is_active);

      let isAvailable = false;
      let slots: TimeSlot[] = [];

      if (override) {
        isAvailable = override.is_available ?? false;
        if (isAvailable && override.start_time && override.end_time) {
          slots = this.generateSlots(
            override.start_time,
            override.end_time,
            override.slot_duration || schedule?.slot_duration || 15,
            (schedule?.consultation_types as ConsultationType[]) || (['online', 'in_person'] as ConsultationType[]),
            (appointments || []).filter((a: any) => a.appointment_date === dateStr) || []
          );
        }
      } else if (schedule) {
        isAvailable = true;
        slots = this.generateSlots(
          schedule.start_time,
          schedule.end_time,
          schedule.slot_duration,
          (schedule.consultation_types as ConsultationType[]) || (['online', 'in_person'] as ConsultationType[]),
          (appointments || []).filter((a: any) => a.appointment_date === dateStr) || [],
          schedule.break_start,
          schedule.break_end,
          // DB column is `max_appointments`
          (schedule.max_appointments as number) || 1
        );
      }

      availability.push({
        date: dateStr,
        day_of_week: dayIndex,
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

    const totalEarnings = (earnings as any[] | undefined)?.reduce((sum, p) => sum + (p?.doctor_payout || 0), 0) || 0;

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
