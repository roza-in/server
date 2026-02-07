import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../../common/errors/index.js';
import { slotService } from './slot.service.js';
import type {
  DoctorSchedule,
  ScheduleOverride,
  WeeklySchedule,
  DayOfWeek,
  ScheduleOverrideType,
} from './schedule.types.js';
import type {
  CreateScheduleInput,
  BulkCreateSchedulesInput,
  UpdateScheduleInput,
  CreateOverrideInput,
} from './schedule.validator.js';

/**
 * Schedule Service - Hospital-managed doctor schedules
 * Only hospital admins can create/update/delete schedules
 */
class ScheduleService {
  private log = logger.child('ScheduleService');
  private supabase = supabaseAdmin;

  private dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  /**
   * Get doctor's weekly schedule (public)
   */
  async getDoctorSchedules(doctorId: string): Promise<WeeklySchedule> {
    const doctor = await doctorRepository.findWithRelations(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    const { data: schedules, error } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (error) {
      this.log.error('Failed to fetch schedules', error);
      throw error;
    }

    // Group by day
    const weeklySchedule: WeeklySchedule = {};
    for (const day of this.dayOrder) {
      weeklySchedule[day] = {
        dayName: this.capitalizeFirst(day),
        schedules: [],
      };
    }

    for (const schedule of schedules || []) {
      const day = schedule.day_of_week as DayOfWeek;
      if (weeklySchedule[day]) {
        weeklySchedule[day].schedules.push({
          id: schedule.id,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          breakStart: schedule.break_start,
          breakEnd: schedule.break_end,
          slotDurationMinutes: schedule.slot_duration_minutes || 15,
          isActive: schedule.is_active,
        });
      }
    }

    return weeklySchedule;
  }

  /**
   * Create a single schedule (hospital admin only)
   */
  async createSchedule(
    doctorId: string,
    userId: string,
    role: string,
    data: CreateScheduleInput
  ): Promise<DoctorSchedule> {
    // Verify hospital-only permission
    await this.verifyHospitalPermission(doctorId, userId, role);

    // Validate time range
    if (data.startTime >= data.endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Check for overlapping schedules on same day
    const overlaps = await this.checkOverlappingSchedules(
      doctorId,
      data.dayOfWeek,
      data.startTime,
      data.endTime
    );

    if (overlaps.length > 0) {
      throw new ConflictError('Schedule overlaps with existing schedule');
    }

    // Check for existing inactive schedule at same time (to avoid unique constraint violation)
    const { data: existingInactive } = await this.supabase
      .from('doctor_schedules')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', data.dayOfWeek)
      .eq('start_time', data.startTime)
      .eq('is_active', false)
      .maybeSingle();

    let result;

    if (existingInactive) {
      // Reactivate and update existing schedule
      const { data: updated, error } = await this.supabase
        .from('doctor_schedules')
        .update({
          end_time: data.endTime,
          break_start: data.breakStart || null,
          break_end: data.breakEnd || null,
          slot_duration_minutes: data.slotDurationMinutes || null,
          max_patients_per_slot: data.maxPatientsPerSlot || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingInactive.id)
        .select()
        .single();

      result = { data: updated, error };
    } else {
      // Insert new schedule
      const { data: inserted, error } = await this.supabase
        .from('doctor_schedules')
        .insert({
          doctor_id: doctorId,
          day_of_week: data.dayOfWeek,
          start_time: data.startTime,
          end_time: data.endTime,
          break_start: data.breakStart || null,
          break_end: data.breakEnd || null,
          slot_duration_minutes: data.slotDurationMinutes || null,
          max_patients_per_slot: data.maxPatientsPerSlot || null,
          is_active: true,
        })
        .select()
        .single();

      result = { data: inserted, error };
    }

    const { data: schedule, error } = result;

    if (error) {
      this.log.error('Failed to create schedule', error);
      throw error;
    }

    // Auto-generate slots for next 30 days in background
    slotService.regenerateSlots(doctorId).catch(err => {
      this.log.error('Background slot regeneration failed after schedule create', err);
    });

    this.log.info(`Schedule created for doctor ${doctorId} on ${data.dayOfWeek}`);
    return this.transformSchedule(schedule);
  }

  /**
   * Bulk create schedules (replaces existing)
   */
  async bulkCreateSchedules(
    doctorId: string,
    userId: string,
    role: string,
    data: BulkCreateSchedulesInput
  ): Promise<DoctorSchedule[]> {
    // Verify hospital-only permission
    await this.verifyHospitalPermission(doctorId, userId, role);

    // Validate all schedules
    for (const schedule of data.schedules) {
      if (schedule.startTime >= schedule.endTime) {
        throw new BadRequestError(`Invalid time range for ${schedule.dayOfWeek}`);
      }
    }

    // Soft delete existing active schedules
    await this.supabase
      .from('doctor_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('doctor_id', doctorId);

    // Insert new schedules
    const schedulesToInsert = data.schedules.map(s => ({
      doctor_id: doctorId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      break_start: s.breakStart || null,
      break_end: s.breakEnd || null,
      slot_duration_minutes: s.slotDurationMinutes || null,
      max_patients_per_slot: s.maxPatientsPerSlot || null,
      is_active: true,
    }));

    const { data: schedules, error } = await this.supabase
      .from('doctor_schedules')
      .insert(schedulesToInsert)
      .select();

    if (error) {
      this.log.error('Failed to bulk create schedules', error);
      throw error;
    }

    // Regenerate slots in background
    slotService.regenerateSlots(doctorId).catch(err => {
      this.log.error('Background slot regeneration failed after bulk schedule create', err);
    });

    this.log.info(`Bulk schedules created for doctor ${doctorId}: ${data.schedules.length} schedules`);
    return (schedules || []).map(s => this.transformSchedule(s));
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    scheduleId: string,
    userId: string,
    role: string,
    data: UpdateScheduleInput
  ): Promise<DoctorSchedule> {
    // Get schedule
    const { data: schedule, error: fetchError } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !schedule) {
      throw new NotFoundError('Schedule');
    }

    // Verify hospital-only permission
    await this.verifyHospitalPermission(schedule.doctor_id, userId, role);

    // Validate time range if updating times
    const startTime = data.startTime || schedule.start_time;
    const endTime = data.endTime || schedule.end_time;
    if (startTime >= endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Build update data
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.startTime !== undefined) updateData.start_time = data.startTime;
    if (data.endTime !== undefined) updateData.end_time = data.endTime;
    if (data.breakStart !== undefined) updateData.break_start = data.breakStart;
    if (data.breakEnd !== undefined) updateData.break_end = data.breakEnd;
    if (data.slotDurationMinutes !== undefined) updateData.slot_duration_minutes = data.slotDurationMinutes;
    if (data.maxPatientsPerSlot !== undefined) updateData.max_patients_per_slot = data.maxPatientsPerSlot;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: updated, error } = await this.supabase
      .from('doctor_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      this.log.error('Failed to update schedule', error);
      throw error;
    }

    // Regenerate slots if times changed
    if (data.startTime || data.endTime || data.slotDurationMinutes || data.isActive !== undefined) {
      // Regenerate slots in background
      slotService.regenerateSlots(schedule.doctor_id).catch(err => {
        this.log.error('Background slot regeneration failed after schedule update', err);
      });
    }

    return this.transformSchedule(updated);
  }

  /**
   * Delete a schedule (soft delete)
   */
  async deleteSchedule(scheduleId: string, userId: string, role: string): Promise<void> {
    // Get schedule
    const { data: schedule, error: fetchError } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !schedule) {
      throw new NotFoundError('Schedule');
    }

    // Verify hospital-only permission
    await this.verifyHospitalPermission(schedule.doctor_id, userId, role);

    // Soft delete
    const { error } = await this.supabase
      .from('doctor_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', scheduleId);

    if (error) {
      this.log.error('Failed to delete schedule', error);
      throw error;
    }

    // Regenerate slots in background
    slotService.regenerateSlots(schedule.doctor_id).catch(err => {
      this.log.error('Background slot regeneration failed after schedule delete', err);
    });

    this.log.info(`Schedule ${scheduleId} deleted`);
  }

  // ============================================================
  // SCHEDULE OVERRIDES
  // ============================================================

  /**
   * Create schedule override (holiday, leave, special hours)
   */
  async createOverride(
    doctorId: string,
    userId: string,
    role: string,
    data: CreateOverrideInput
  ): Promise<ScheduleOverride> {
    // Verify hospital-only permission
    await this.verifyHospitalPermission(doctorId, userId, role);

    // Check for existing override on same date
    const { data: existing } = await this.supabase
      .from('schedule_overrides')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('override_date', data.overrideDate)
      .single();

    if (existing) {
      // Update existing override
      const { data: updated, error } = await this.supabase
        .from('schedule_overrides')
        .update({
          override_type: data.overrideType,
          start_time: data.startTime || null,
          end_time: data.endTime || null,
          reason: data.reason || null,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        this.log.error('Failed to update override', error);
        throw error;
      }

      // Update slots for this date
      await this.applyOverrideToSlots(doctorId, data.overrideDate, data.overrideType, data.reason);

      return this.transformOverride(updated);
    }

    // Create new override
    const { data: override, error } = await this.supabase
      .from('schedule_overrides')
      .insert({
        doctor_id: doctorId,
        override_date: data.overrideDate,
        override_type: data.overrideType,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        reason: data.reason || null,
      })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to create override', error);
      throw error;
    }

    // Apply override to existing slots
    await this.applyOverrideToSlots(doctorId, data.overrideDate, data.overrideType, data.reason);

    this.log.info(`Override created for doctor ${doctorId} on ${data.overrideDate}: ${data.overrideType}`);
    return this.transformOverride(override);
  }

  /**
   * Get overrides for date range
   */
  async getOverrides(
    doctorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ScheduleOverride[]> {
    let query = this.supabase
      .from('schedule_overrides')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('override_date', { ascending: true });

    if (startDate) {
      query = query.gte('override_date', startDate);
    }
    if (endDate) {
      query = query.lte('override_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      this.log.error('Failed to fetch overrides', error);
      throw error;
    }

    return (data || []).map(o => this.transformOverride(o));
  }

  /**
   * Delete override
   */
  async deleteOverride(overrideId: string, userId: string, role: string): Promise<void> {
    // Get override
    const { data: override, error: fetchError } = await this.supabase
      .from('schedule_overrides')
      .select('*')
      .eq('id', overrideId)
      .single();

    if (fetchError || !override) {
      throw new NotFoundError('Schedule override');
    }

    // Verify hospital-only permission
    await this.verifyHospitalPermission(override.doctor_id, userId, role);

    const { error } = await this.supabase
      .from('schedule_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      this.log.error('Failed to delete override', error);
      throw error;
    }

    // Regenerate slots for the affected date to restore normal schedule
    try {
      const overrideDate = new Date(override.override_date);
      await slotService.generateSlots(override.doctor_id, overrideDate, overrideDate);
    } catch (err) {
      this.log.warn('Slot regeneration failed after override delete', err);
    }

    this.log.info(`Override ${overrideId} deleted`);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Verify user is hospital admin for this doctor (not doctor themselves)
   */
  private async verifyHospitalPermission(doctorId: string, userId: string, role: string): Promise<void> {
    // Admin can do anything
    if (role === 'admin') {
      return;
    }

    // Only hospital role can manage schedules
    if (role !== 'hospital') {
      throw new ForbiddenError('Only hospital administrators can manage schedules');
    }

    // Get doctor with hospital info
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .select('*, hospitals!doctors_hospital_id_fkey(admin_user_id)')
      .eq('id', doctorId)
      .single();

    if (error || !doctor) {
      throw new NotFoundError('Doctor');
    }

    // Check if user is the hospital admin
    const hospitalAdminId = doctor.hospitals?.admin_user_id;
    if (hospitalAdminId !== userId) {
      throw new ForbiddenError('You can only manage schedules for doctors in your hospital');
    }
  }

  /**
   * Check for overlapping schedules on same day
   * NOTE: Consultation types are now global per doctor, so we just check time overlaps
   */
  private async checkOverlappingSchedules(
    doctorId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<any[]> {
    let query = this.supabase
      .from('doctor_schedules')
      .select('id, start_time, end_time')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: schedules, error } = await query;

    if (error) {
      this.log.error('Failed to check overlapping schedules', error);
      return [];
    }

    // Check for overlaps
    return (schedules || []).filter(s => {
      // Overlap if NOT (new end <= existing start OR new start >= existing end)
      return !(endTime <= s.start_time || startTime >= s.end_time);
    });
  }

  /**
   * Apply override to existing slots
   */
  private async applyOverrideToSlots(
    doctorId: string,
    date: string,
    overrideType: ScheduleOverrideType,
    reason?: string
  ): Promise<void> {
    if (overrideType === 'holiday' || overrideType === 'leave') {
      // Block all slots for this date
      await slotService.blockSlotsForDate(doctorId, date, reason || 'Doctor unavailable');
    } else if (overrideType === 'special_hours') {
      // Regenerate slots for this date with override times
      const overrideDate = new Date(date);
      await slotService.generateSlots(doctorId, overrideDate, overrideDate);
    }
  }

  /**
   * Transform schedule row to API response
   * NOTE: consultationType removed - use doctor.consultation_types instead
   */
  private transformSchedule(row: any): DoctorSchedule {
    return {
      id: row.id,
      doctorId: row.doctor_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      breakStart: row.break_start,
      breakEnd: row.break_end,
      slotDurationMinutes: row.slot_duration_minutes,
      maxPatientsPerSlot: row.max_patients_per_slot,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Transform override row to API response
   */
  private transformOverride(row: any): ScheduleOverride {
    return {
      id: row.id,
      doctorId: row.doctor_id,
      overrideDate: row.override_date,
      overrideType: row.override_type,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
      createdAt: row.created_at,
    };
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const scheduleService = new ScheduleService();
