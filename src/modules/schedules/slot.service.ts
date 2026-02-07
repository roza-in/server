import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import type { DayOfWeek, ConsultationType, AppointmentSlot, AvailableSlot } from './schedule.types.js';

/**
 * Slot Service - Generates and manages appointment slots from schedules
 */
class SlotService {
    private log = logger.child('SlotService');
    private supabase = supabaseAdmin;

    private dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    /**
     * Generate slots for a doctor for a date range
     * Called when schedules change or via daily cron
     */
    async generateSlots(doctorId: string, startDate: Date, endDate: Date): Promise<number> {
        // Collect all slots to upsert in bulk
        const slotsToUpsert: any[] = [];

        // Get all active schedules for this doctor
        const { data: schedules, error: scheduleError } = await this.supabase
            .from('doctor_schedules')
            .select('*')
            .eq('doctor_id', doctorId)
            .eq('is_active', true);

        if (scheduleError) {
            this.log.error('Failed to fetch schedules for slot generation', scheduleError);
            throw scheduleError;
        }

        if (!schedules || schedules.length === 0) {
            this.log.info(`No active schedules for doctor ${doctorId}`);
            return 0;
        }

        // Get all overrides in date range
        const { data: overrides, error: overrideError } = await this.supabase
            .from('schedule_overrides')
            .select('*')
            .eq('doctor_id', doctorId)
            .gte('override_date', this.formatDate(startDate))
            .lte('override_date', this.formatDate(endDate));

        if (overrideError) {
            this.log.error('Failed to fetch overrides for slot generation', overrideError);
        }

        const overrideMap = new Map(
            (overrides || []).map(o => [o.override_date, o])
        );

        // Get doctor for slot config
        const doctor = await doctorRepository.findWithRelations(doctorId);
        const defaultSlotDuration = doctor?.slotDurationMinutes || 15;
        const defaultMaxPatients = doctor?.maxPatientsPerSlot || 1;

        // For each date in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
            const dayOfWeek = this.dayNames[currentDate.getDay()];

            // Check if override exists (holiday/leave = skip)
            const override = overrideMap.get(dateStr);
            if (override && (override.override_type === 'holiday' || override.override_type === 'leave')) {
                // Block existing slots for this day
                await this.blockSlotsForDate(doctorId, dateStr, override.reason || 'Doctor unavailable');
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            // Get schedules for this day
            const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);

            // If special_hours override, use override times instead
            let effectiveSchedules = daySchedules;
            if (override && override.override_type === 'special_hours' && override.start_time && override.end_time) {
                effectiveSchedules = [{
                    ...daySchedules[0],
                    start_time: override.start_time,
                    end_time: override.end_time,
                    break_start: null,
                    break_end: null,
                }];
            }

            // Generate slots for each schedule
            for (const schedule of effectiveSchedules) {
                const slotDuration = schedule.slot_duration_minutes || defaultSlotDuration;
                const maxPatients = schedule.max_patients_per_slot || defaultMaxPatients;

                const generatedTimeSlots = this.generateTimeSlots(
                    schedule.start_time,
                    schedule.end_time,
                    slotDuration,
                    schedule.break_start,
                    schedule.break_end
                );

                for (const slot of generatedTimeSlots) {
                    slotsToUpsert.push({
                        doctor_id: doctorId,
                        slot_date: dateStr,
                        start_time: `${dateStr}T${slot.start}:00`,
                        end_time: `${dateStr}T${slot.end}:00`,
                        consultation_type: schedule.consultation_type,
                        max_bookings: maxPatients,
                        is_available: true,
                        is_blocked: false,
                    });
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Bulk upsert all collected slots
        if (slotsToUpsert.length > 0) {
            const { error: upsertError } = await this.supabase
                .from('appointment_slots')
                .upsert(slotsToUpsert, {
                    onConflict: 'doctor_id,start_time,consultation_type',
                    ignoreDuplicates: true,
                });

            if (upsertError) {
                this.log.error('Failed to bulk upsert slots', upsertError);
                throw upsertError;
            }
        }

        this.log.info(`Generated ${slotsToUpsert.length} slots for doctor ${doctorId}`);
        return slotsToUpsert.length;
    }

    /**
     * Get available slots for booking
     */
    async getAvailableSlots(
        doctorId: string,
        date: string,
        consultationType?: ConsultationType
    ): Promise<AvailableSlot[]> {
        let query = this.supabase
            .from('appointment_slots')
            .select('*')
            .eq('doctor_id', doctorId)
            .eq('slot_date', date)
            .eq('is_available', true)
            .eq('is_blocked', false)
            .order('start_time', { ascending: true });

        if (consultationType) {
            query = query.eq('consultation_type', consultationType);
        }

        const { data: slots, error } = await query;

        if (error) {
            this.log.error('Failed to fetch available slots', error);
            throw error;
        }

        // Get doctor for fee info
        const doctor = await doctorRepository.findWithRelations(doctorId);

        return (slots || [])
            .filter(s => s.current_bookings < s.max_bookings)
            .map(s => ({
                date: s.slot_date,
                startTime: s.start_time,
                endTime: s.end_time,
                consultationType: s.consultation_type,
                remainingCapacity: s.max_bookings - s.current_bookings,
                fee: this.getConsultationFee(doctor, s.consultation_type),
            }));
    }

    /**
     * Block slots for a date (used for overrides)
     */
    async blockSlotsForDate(doctorId: string, date: string, reason: string): Promise<void> {
        const { error } = await this.supabase
            .from('appointment_slots')
            .update({
                is_blocked: true,
                block_reason: reason,
            })
            .eq('doctor_id', doctorId)
            .eq('slot_date', date)
            .eq('current_bookings', 0); // Only block slots with no bookings

        if (error) {
            this.log.error('Failed to block slots', error);
        }
    }

    /**
     * Delete future slots for a doctor (used when schedule changes)
     */
    async deleteFutureSlots(doctorId: string, fromDate: Date): Promise<void> {
        const { error } = await this.supabase
            .from('appointment_slots')
            .delete()
            .eq('doctor_id', doctorId)
            .gte('slot_date', this.formatDate(fromDate))
            .eq('current_bookings', 0); // Only delete slots with no bookings

        if (error) {
            this.log.error('Failed to delete future slots', error);
        }
    }

    /**
     * Regenerate slots after schedule change
     */
    async regenerateSlots(doctorId: string): Promise<number> {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // Delete existing future slots (without bookings)
        await this.deleteFutureSlots(doctorId, today);

        // Generate new slots
        return this.generateSlots(doctorId, today, endDate);
    }

    /**
     * Generate all slots for all active doctors (cron job)
     */
    async generateSlotsForAllDoctors(): Promise<{ doctorCount: number; totalSlots: number }> {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // Get all verified, active doctors
        const { data: doctors, error } = await this.supabase
            .from('doctors')
            .select('id')
            .eq('is_active', true)
            .eq('verification_status', 'verified');

        if (error) {
            this.log.error('Failed to fetch doctors for slot generation', error);
            throw error;
        }

        let totalSlots = 0;
        for (const doctor of doctors || []) {
            try {
                const count = await this.generateSlots(doctor.id, today, endDate);
                totalSlots += count;
            } catch (err) {
                this.log.error(`Slot generation failed for doctor ${doctor.id}`, err);
            }
        }

        this.log.info(`Slot generation complete: ${doctors?.length || 0} doctors, ${totalSlots} slots`);
        return { doctorCount: doctors?.length || 0, totalSlots };
    }

    // ============================================================
    // Private Helpers
    // ============================================================

    private generateTimeSlots(
        startTime: string,
        endTime: string,
        durationMinutes: number,
        breakStart?: string | null,
        breakEnd?: string | null
    ): { start: string; end: string }[] {
        const slots: { start: string; end: string }[] = [];

        let current = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);
        const breakStartMins = breakStart ? this.timeToMinutes(breakStart) : null;
        const breakEndMins = breakEnd ? this.timeToMinutes(breakEnd) : null;

        while (current + durationMinutes <= end) {
            const slotEnd = current + durationMinutes;

            // Skip if slot overlaps with break
            if (breakStartMins !== null && breakEndMins !== null) {
                if (!(slotEnd <= breakStartMins || current >= breakEndMins)) {
                    current = breakEndMins;
                    continue;
                }
            }

            slots.push({
                start: this.minutesToTime(current),
                end: this.minutesToTime(slotEnd),
            });

            current = slotEnd;
        }

        return slots;
    }


    private timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private getConsultationFee(doctor: any, type: string): number {
        if (!doctor) return 0;
        switch (type) {
            case 'online':
                return doctor.consultation_fee_online || doctor.consultation_fee_in_person || 0;
            case 'walk_in':
                return doctor.consultation_fee_walk_in || doctor.consultation_fee_in_person || 0;
            default:
                return doctor.consultation_fee_in_person || 0;
        }
    }
}

export const slotService = new SlotService();
