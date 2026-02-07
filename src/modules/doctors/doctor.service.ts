import { logger } from '../../config/logger.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import type {
  DoctorSchedule,
  ScheduleOverride,
  ConsultationType,
  DayOfWeek,
  VerificationStatus
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
  DoctorListItem
} from './doctor.types.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import { specializationRepository } from '../../database/repositories/specialization.repo.js';

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayName = typeof DAY_NAMES[number];

function normalizeDayOfWeek(v: any): DayName {
  if (typeof v === 'number') {
    const idx = Number(v);
    return DAY_NAMES[idx] as DayName;
  }
  if (typeof v === 'string') {
    return v.toLowerCase() as DayName;
  }
  throw new BadRequestError('Invalid day_of_week value');
}

/**
 * Doctor Service - Domain logic for doctors
 */
class DoctorService {
  private log = logger.child('DoctorService');

  /**
   * Add a new doctor (triggered by hospital)
   */
  async add(data: Partial<UpdateDoctorInput>, userId: string): Promise<DoctorProfile> {
    const hospital = await hospitalRepository.findByUserId(userId);
    if (!hospital) {
      throw new ForbiddenError('Only hospital administrators can add doctors');
    }

    let doctorUserId: string;
    let createdUserId: string | null = null;

    if ((data as any).user_id) {
      const user = await userRepository.findById((data as any).user_id);
      if (!user) throw new BadRequestError('Provided user_id not found');
      doctorUserId = user.id;

      if (user.role !== 'doctor') {
        await userRepository.update(user.id, {
          role: 'doctor',
          name: (data as any).name || (data as any).name || user.name
        } as any);
      }
    } else if ((data as any).phone) {
      const phone = String((data as any).phone).trim();
      const existingUser = await userRepository.findByPhone(phone);

      if (existingUser) {
        doctorUserId = existingUser.id;
        if (existingUser.role !== 'doctor') {
          await userRepository.update(existingUser.id, {
            role: 'doctor',
            name: (data as any).name || (data as any).name || existingUser.name
          } as any);
        }
      } else {
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        const newUser = await userRepository.create({
          phone,
          name: (data as any).name || (data as any).name || null,
          email: (data as any).email || null,
          role: 'doctor',
          is_active: true,
          password_hash: passwordHash,
        } as any);

        doctorUserId = newUser.id;
        createdUserId = doctorUserId;
      }
    } else {
      throw new BadRequestError('Provide phone or user_id to create doctor');
    }

    // Build insert data matching exact database schema
    const insertData: any = {
      user_id: doctorUserId,
      hospital_id: hospital.id,
      specialization_id: (data as any).specialization_id || (data as any).specializationId || null,
      registration_number: (data as any).registrationNumber || (data as any).medicalRegistrationNumber || 'PENDING',
      registration_council: (data as any).registrationCouncil || null,
      registration_year: (data as any).registrationYear ? Number((data as any).registrationYear) : null,
      qualifications: (data as any).qualifications
        ? (Array.isArray((data as any).qualifications) ? (data as any).qualifications : [(data as any).qualifications])
        : null,
      experience_years: Number((data as any).experienceYears || (data as any).yearsOfExperience || 0),
      bio: (data as any).bio || null,
      languages: (data as any).languages_spoken || (data as any).languages || ['English', 'Hindi'],
      // Fees
      consultation_fee_online: Number((data as any).consultationFeeOnline || 0),
      consultation_fee_in_person: Number((data as any).consultationFeeInPerson || 0),
      consultation_fee_walk_in: Number((data as any).consultationFeeWalkIn || 0),
      follow_up_fee: (data as any).followUpFee ? Number((data as any).followUpFee) : null,
      follow_up_validity_days: Number((data as any).followUpValidityDays || 7),
      // Slot config
      slot_duration_minutes: Number((data as any).slotDurationMinutes || 15),
      buffer_time_minutes: Number((data as any).bufferTimeMinutes || 5),
      max_patients_per_slot: Number((data as any).maxPatientsPerSlot || 1),
      // Consultation types
      online_consultation_enabled: (data as any).onlineConsultationEnabled === true,
      walk_in_enabled: (data as any).walkInEnabled !== false, // Default true
      // Image (use og_image_url as that's what exists in schema)
      og_image_url: (data as any).profileImageUrl || (data as any).profile_image_url || null,
      // Status
      verification_status: 'pending',
      is_active: false,
      is_available: true,
    };

    // If specialization name is passed, look up the ID
    if (!insertData.specialization_id && (data as any).specialization) {
      // For now, require specialization_id or fail gracefully
      this.log.warn('No specialization_id provided, doctor may fail FK constraint');
    }

    try {
      const doctor = await doctorRepository.create(insertData);
      return await doctorRepository.findWithRelations(doctor.id) as DoctorProfile;
    } catch (err: any) {
      this.log.error('Error in create [doctors]:', err);
      // Clean up created user if we created one
      if (createdUserId) {
        try {
          await userRepository.delete(createdUserId);
          this.log.info(`Cleaned up orphaned user ${createdUserId} after failed doctor creation`);
        } catch (cleanupErr) {
          this.log.error('Failed to cleanup user after doctor creation error', cleanupErr);
        }
      }
      throw new BadRequestError(`Failed to add doctor: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Get doctor by ID
   */
  async getById(doctorId: string): Promise<DoctorProfile> {
    const doctor = await doctorRepository.findWithRelations(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');
    return doctor as unknown as DoctorProfile;
  }


  /**
   * Get doctor by user ID
   */
  async getByUserId(userId: string): Promise<DoctorProfile> {
    const doctor = await doctorRepository.findByUserId(userId);
    if (!doctor) throw new NotFoundError('Doctor profile not found');
    return doctor as unknown as DoctorProfile;
  }

  /**
   * Get doctor public profile
   */
  async getPublicProfile(doctorId: string): Promise<DoctorPublicProfile> {
    const doctor = await doctorRepository.findWithRelations(doctorId);
    if (!doctor || !doctor.is_active) throw new NotFoundError('Doctor not found');

    const availability = await this.getAvailability(doctorId, 7);

    return {
      id: doctor.id,
      title: doctor.title || '',
      name: doctor.user?.name || doctor.users?.name || '',
      avatar_url: doctor.user?.avatar_url || doctor.users?.avatar_url || (doctor as any).user?.profile_picture_url,
      specialization: typeof doctor.specialization === 'string' ? doctor.specialization : (doctor.specialization?.name || null),
      qualifications: doctor.qualifications || [],
      experience_years: doctor.experience_years,
      bio: doctor.bio,
      languages_spoken: (doctor as any).languages || (doctor as any).languages_spoken || [],

      // Extended Profile Data
      registration_number: doctor.registration_number,
      registration_council: doctor.registration_council,
      registration_year: doctor.registration_year,
      awards: doctor.awards || [],
      publications: doctor.publications || [],
      certifications: doctor.certifications || [],
      memberships: doctor.memberships || [],
      services: doctor.available_service || [],
      social_profiles: doctor.social_profiles,
      consultation_fee_online: doctor.online_consultation_fee || (doctor as any).consultation_fee_online,
      consultation_fee_in_person: doctor.consultation_fee || (doctor as any).consultation_fee_in_person,
      consultation_fee_walk_in: doctor.follow_up_fee || (doctor as any).consultation_fee_walk_in,
      consultation_duration: doctor.consultation_duration,
      accepts_online: !!doctor.online_consultation_fee,
      accepts_in_person: !!doctor.consultation_fee,
      accepts_walk_in: !!doctor.follow_up_fee,
      rating: doctor.rating,
      total_ratings: doctor.total_ratings,
      hospital: doctor.hospital || null,
      availability,
    };
  }

  /**
   * List doctors with filters
   */
  async list(filters: DoctorFilters): Promise<DoctorListResponse> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      // Use findManyWithRelations to get complete doctor data with user/hospital/specialization info
      const result = await doctorRepository.findManyWithRelations(filters, page, limit);

      return {
        doctors: result.data as unknown as DoctorListItem[],
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        hasMore: page * limit < result.total,
      };
    } catch (error) {
      this.log.error('Failed to fetch doctors', error);
      throw new BadRequestError('Failed to fetch doctors');
    }
  }

  /**
   * Update doctor profile
   */
  async update(doctorId: string, userId: string, role: string, data: UpdateDoctorInput): Promise<DoctorProfile> {
    const doctor = await doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');

    // Ownership check
    if (doctor.user_id !== userId && role !== 'admin') {
      const hospital = await hospitalRepository.findById(doctor.hospital_id!);
      if (!hospital || hospital.admin_user_id !== userId) {
        throw new ForbiddenError('Access denied');
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    const fields = [
      'title', 'specialization_id', 'qualifications', 'experience_years',
      'bio', 'languages_spoken', 'consultation_fee_online', 'consultation_fee_in_person',
      'consultation_fee_walk_in', 'consultation_duration', 'accepts_online',
      'accepts_in_person', 'accepts_walk_in', 'max_patients_per_day',
      'registration_number', 'registration_council', 'license_number',
      'signature_url', 'stamp_url'
    ];

    fields.forEach(f => { if ((data as any)[f] !== undefined) updateData[f] = (data as any)[f]; });

    try {
      await doctorRepository.update(doctorId, updateData);
      return await doctorRepository.findWithRelations(doctorId) as DoctorProfile;
    } catch (error) {
      throw new BadRequestError('Failed to update doctor profile');
    }
  }

  /**
   * Update doctor status
   */
  async updateStatus(doctorId: string, userId: string, role: string, status: string): Promise<DoctorProfile> {
    const doctor = await doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');

    if (role === 'hospital') {
      const hospital = await hospitalRepository.findById(doctor.hospital_id!);
      if (!hospital || hospital.admin_user_id !== userId) throw new ForbiddenError('Access denied');
    } else if (role !== 'admin') {
      throw new ForbiddenError('Access denied');
    }

    try {
      await doctorRepository.update(doctorId, {
        is_active: status === 'active',
        verification_status: status === 'suspended' ? 'suspended' : doctor.verification_status,
        updated_at: new Date().toISOString()
      } as any);
      return await doctorRepository.findWithRelations(doctorId) as DoctorProfile;
    } catch (error) {
      throw new BadRequestError('Failed to update doctor status');
    }
  }

  /**
   * Get doctor schedules
   */
  async getSchedules(doctorId: string): Promise<DoctorSchedule[]> {
    return await doctorRepository.getSchedules(doctorId);
  }

  /**
   * Set doctor schedule
   */
  async setSchedule(doctorId: string, userId: string, schedule: any): Promise<DoctorSchedule> {
    const doctor = await doctorRepository.findById(doctorId);
    if (doctor?.user_id !== userId) throw new ForbiddenError('Access denied');

    return await doctorRepository.upsertSchedule(doctorId, {
      day_of_week: normalizeDayOfWeek(schedule.day_of_week),
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      slot_duration: schedule.slot_duration || 15,
      buffer_time: schedule.buffer_time || 5,
      break_start: schedule.break_start || null,
      break_end: schedule.break_end || null,
      max_appointments: schedule.max_patients_per_slot || 1,
      consultation_types: schedule.consultation_types || ['online', 'in_person'],
      is_active: schedule.is_active ?? true,
    });
  }

  /**
   * Set multiple schedules
   */
  async setSchedules(doctorId: string, userId: string, schedules: any[]): Promise<DoctorSchedule[]> {
    const doctor = await doctorRepository.findById(doctorId);
    if (doctor?.user_id !== userId) throw new ForbiddenError('Access denied');

    return await Promise.all(schedules.map(s => this.setSchedule(doctorId, userId, s)));
  }

  /**
   * Add schedule override
   */
  async addScheduleOverride(doctorId: string, userId: string, override: any): Promise<ScheduleOverride> {
    const doctor = await doctorRepository.findById(doctorId);
    if (doctor?.user_id !== userId) throw new ForbiddenError('Access denied');

    return await doctorRepository.upsertOverride(doctorId, {
      override_date: override.override_date,
      is_available: override.is_available,
      reason: override.reason || null,
      start_time: override.custom_start_time || null,
      end_time: override.custom_end_time || null,
      slot_duration: override.custom_slot_duration || null,
    });
  }

  /**
   * Get doctor availability for N days
   */
  async getAvailability(doctorId: string, days: number = 7): Promise<DoctorDayAvailability[]> {
    const schedules = await doctorRepository.getSchedules(doctorId);
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = await doctorRepository.getAvailabilityData(doctorId, startDate, endDate);
    const availability: DoctorDayAvailability[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1];

      const override = data.overrides.find((o: any) => o.override_date === dateStr);
      const schedule = schedules.find((s: any) => s.day_of_week === dayOfWeek && s.is_active);

      let isAvailable = false;
      let slots: TimeSlot[] = [];

      if (override) {
        isAvailable = override.is_available;
        if (isAvailable && override.start_time && override.end_time) {
          slots = this.generateSlots(
            override.start_time, override.end_time,
            override.slot_duration || schedule?.slot_duration || 15,
            schedule?.consultation_types || ['online', 'in_person'],
            data.appointments.filter((a: any) => a.scheduled_date === dateStr)
          );
        }
      } else if (schedule) {
        isAvailable = true;
        slots = this.generateSlots(
          schedule.start_time, schedule.end_time, schedule.slot_duration,
          schedule.consultation_types,
          data.appointments.filter((a: any) => a.scheduled_date === dateStr),
          schedule.break_start, schedule.break_end, schedule.max_appointments
        );
      }

      availability.push({
        date: dateStr,
        day_of_week: date.getDay() as DayOfWeek,
        is_available: isAvailable,
        slots,
        override: override || undefined
      });
    }

    return availability;
  }

  /**
   * Generate time slots helper
   */
  private generateSlots(
    startTime: string, endTime: string, slotDuration: number,
    consultationTypes: ConsultationType[], booked: any[],
    breakStart?: string | null, breakEnd?: string | null, maxCapacity: number = 1
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let [currH, currM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    while (currH * 60 + currM + slotDuration <= endMinutes) {
      const start = `${String(currH).padStart(2, '0')}:${String(currM).padStart(2, '0')}`;
      const totalStart = currH * 60 + currM;
      const totalEnd = totalStart + slotDuration;
      const end = `${String(Math.floor(totalEnd / 60)).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}`;

      currM += slotDuration;
      if (currM >= 60) { currH += Math.floor(currM / 60); currM %= 60; }

      // Check break
      if (breakStart && breakEnd) {
        const [bSH, bSM] = breakStart.split(':').map(Number);
        const [bEH, bEM] = breakEnd.split(':').map(Number);
        const bS = bSH * 60 + bSM;
        const bE = bEH * 60 + bEM;
        if (totalStart < bE && totalEnd > bS) continue;
      }

      const count = booked.filter(a => {
        const time = a.scheduled_start?.includes('T') ? a.scheduled_start.split('T')[1].substring(0, 5) : a.scheduled_start;
        return time === start;
      }).length;
      slots.push({
        start_time: start,
        end_time: end,
        is_available: count < maxCapacity,
        is_booked: count >= maxCapacity,
        remaining_capacity: Math.max(0, maxCapacity - count),
        max_capacity: maxCapacity,
        consultation_types: consultationTypes
      });
    }
    return slots;
  }

  /**
   * Get doctor statistics
   */
  async getStats(doctorId: string, userId: string, role: string, period?: string): Promise<DoctorStats> {
    const doctor = await doctorRepository.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');

    if (doctor.user_id !== userId && role !== 'admin') {
      const hospital = await hospitalRepository.findById(doctor.hospital_id!);
      if (!hospital || hospital.admin_user_id !== userId) throw new ForbiddenError('Access denied');
    }

    return await doctorRepository.getStats(doctorId);
  }
}

export const doctorService = new DoctorService();

