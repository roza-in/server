// @ts-nocheck
import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors.js';
import type { DoctorSchedule, ScheduleOverride, WeeklySchedule, CreateScheduleInput, CreateOverrideInput } from './schedule.types.js';
import type { BulkCreateSchedulesInput, UpdateScheduleInput } from './schedule.validator.js';

/**
 * Schedule Service - Business logic for doctor schedules
 */
class ScheduleService {
  private logger = logger.child('ScheduleService');
  private supabase = getSupabaseAdmin();

  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /**
   * Get doctor's weekly schedule
   */
  async getDoctorSchedules(doctorId: string): Promise<WeeklySchedule> {
    const doctor = await doctorRepository.findById(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    const { data: schedules, error } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch schedules', error);
      throw error;
    }

    // Group by day
    const weeklySchedule: WeeklySchedule = {};
    for (let day = 0; day < 7; day++) {
      weeklySchedule[day] = {
        dayName: this.dayNames[day],
        schedules: [],
      };
    }

    for (const schedule of schedules || []) {
      weeklySchedule[schedule.day_of_week].schedules.push({
        id: schedule.id,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        slotDuration: schedule.slot_duration,
        consultationType: schedule.consultation_type,
      });
    }

    return weeklySchedule;
  }

  /**
   * Create a single schedule
   */
  async createSchedule(
    doctorId: string,
    userId: string,
    role: string,
    data: CreateScheduleInput
  ): Promise<DoctorSchedule> {
    // Verify permission
    await this.verifyPermission(doctorId, userId, role);

    // Validate time range
    if (data.startTime >= data.endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Check for overlapping schedules
    const { data: existing } = await this.supabase
      .from('doctor_schedules')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', data.dayOfWeek)
      .eq('is_active', true)
      .or(`and(start_time.lt.${data.endTime},end_time.gt.${data.startTime})`);

    if (existing && existing.length > 0) {
      throw new BadRequestError('Schedule overlaps with existing schedule');
    }

    const { data: schedule, error } = await this.supabase
      .from('doctor_schedules')
      .insert({
        doctor_id: doctorId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        slot_duration: data.slotDuration || 15,
        consultation_type: data.consultationType || 'both',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create schedule', error);
      throw error;
    }

    return this.transformSchedule(schedule);
  }

  /**
   * Bulk create schedules
   */
  async bulkCreateSchedules(
    doctorId: string,
    userId: string,
    role: string,
    data: BulkCreateSchedulesInput
  ): Promise<DoctorSchedule[]> {
    // Verify permission
    await this.verifyPermission(doctorId, userId, role);

    // Validate all schedules
    for (const schedule of data.schedules) {
      if (schedule.startTime >= schedule.endTime) {
        throw new BadRequestError(`Invalid time range for day ${schedule.dayOfWeek}`);
      }
    }

    // Delete existing active schedules
    await this.supabase
      .from('doctor_schedules')
      .update({ is_active: false })
      .eq('doctor_id', doctorId);

    // Insert new schedules
    const schedulesToInsert = data.schedules.map(s => ({
      doctor_id: doctorId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      slot_duration: s.slotDuration || 15,
      consultation_type: s.consultationType || 'both',
      is_active: true,
    }));

    const { data: schedules, error } = await this.supabase
      .from('doctor_schedules')
      .insert(schedulesToInsert)
      .select();

    if (error) {
      this.logger.error('Failed to bulk create schedules', error);
      throw error;
    }

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

    // Verify permission
    await this.verifyPermission(schedule.doctor_id, userId, role);

    // Validate time range if updating times
    const startTime = data.startTime || schedule.start_time;
    const endTime = data.endTime || schedule.end_time;
    if (startTime >= endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    const updateData: any = {};
    if (data.startTime !== undefined) updateData.start_time = data.startTime;
    if (data.endTime !== undefined) updateData.end_time = data.endTime;
    if (data.slotDuration !== undefined) updateData.slot_duration = data.slotDuration;
    if (data.consultationType !== undefined) updateData.consultation_type = data.consultationType;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    updateData.updated_at = new Date().toISOString();

    const { data: updated, error } = await this.supabase
      .from('doctor_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update schedule', error);
      throw error;
    }

    return this.transformSchedule(updated);
  }

  /**
   * Delete a schedule
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

    // Verify permission
    await this.verifyPermission(schedule.doctor_id, userId, role);

    // Soft delete by marking inactive
    const { error } = await this.supabase
      .from('doctor_schedules')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', scheduleId);

    if (error) {
      this.logger.error('Failed to delete schedule', error);
      throw error;
    }
  }

  /**
   * Create schedule override
   */
  async createOverride(
    doctorId: string,
    userId: string,
    role: string,
    data: CreateOverrideInput
  ): Promise<ScheduleOverride> {
    // Verify permission
    await this.verifyPermission(doctorId, userId, role);

    // Check for existing override on same date
    const { data: existing } = await this.supabase
      .from('doctor_schedule_overrides')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('date', data.date)
      .single();

    if (existing) {
      // Update existing override
      const { data: updated, error } = await this.supabase
        .from('doctor_schedule_overrides')
        .update({
          is_available: data.isAvailable,
          start_time: data.startTime || null,
          end_time: data.endTime || null,
          reason: data.reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to update override', error);
        throw error;
      }

      return this.transformOverride(updated);
    }

    // Create new override
    const { data: override, error } = await this.supabase
      .from('doctor_schedule_overrides')
      .insert({
        doctor_id: doctorId,
        date: data.date,
        is_available: data.isAvailable,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        reason: data.reason || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create override', error);
      throw error;
    }

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
      .from('doctor_schedule_overrides')
      .select('*')
      .eq('doctor_id', doctorId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    query = query.order('date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to fetch overrides', error);
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
      .from('doctor_schedule_overrides')
      .select('*')
      .eq('id', overrideId)
      .single();

    if (fetchError || !override) {
      throw new NotFoundError('Schedule override');
    }

    // Verify permission
    await this.verifyPermission(override.doctor_id, userId, role);

    const { error } = await this.supabase
      .from('doctor_schedule_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      this.logger.error('Failed to delete override', error);
      throw error;
    }
  }

  /**
   * Verify user has permission to manage doctor schedules
   */
  private async verifyPermission(doctorId: string, userId: string, role: string): Promise<void> {
    const doctor = await doctorRepository.findByIdWithRelations(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    const isOwnProfile = doctor.user_id === userId;
    const isHospitalOwner = role === 'hospital' && doctor.hospitals?.user_id === userId;
    const isAdmin = role === 'admin';

    if (!isOwnProfile && !isHospitalOwner && !isAdmin) {
      throw new ForbiddenError('You do not have permission to manage this schedule');
    }
  }

  /**
   * Transform schedule row
   */
  private transformSchedule(row: any): DoctorSchedule {
    return {
      id: row.id,
      doctorId: row.doctor_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      slotDuration: row.slot_duration,
      consultationType: row.consultation_type,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Transform override row
   */
  private transformOverride(row: any): ScheduleOverride {
    return {
      id: row.id,
      doctorId: row.doctor_id,
      date: row.date,
      isAvailable: row.is_available,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export singleton instance
export const scheduleService = new ScheduleService();

