/**
 * Types for schedules module
 * Hospital-managed doctor schedules and slot generation
 *
 * Response DTOs — camelCase transforms of DB snake_case rows.
 * Input types are inferred from Zod schemas in schedule.validator.ts.
 */

// Re-export canonical enums from database types
export type { DayOfWeek, ConsultationType, ScheduleOverrideType } from '../../types/database.types.js';
import type { DayOfWeek, ConsultationType, ScheduleOverrideType } from '../../types/database.types.js';

// ============================================================
// RESPONSE DTOs (camelCase transforms of DB rows)
// ============================================================

/** Doctor schedule (weekly recurring) */
export interface DoctorScheduleDTO {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  consultationType: ConsultationType;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number | null;
  maxPatientsPerSlot: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Schedule override (for specific dates) */
export interface ScheduleOverrideDTO {
  id: string;
  doctorId: string;
  overrideDate: string;
  overrideType: ScheduleOverrideType;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: string;
}

/** Appointment slot (generated from schedules) */
export interface AppointmentSlotDTO {
  id: string;
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  consultationType: ConsultationType;
  maxBookings: number;
  currentBookings: number;
  lockedUntil: string | null;
  lockedBy: string | null;
  lockVersion: number;
  isAvailable: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  createdAt: string;
}

/** Weekly schedule view (grouped by day) */
export interface WeeklySchedule {
  [day: string]: {
    dayName: string;
    schedules: {
      id: string;
      consultationType: ConsultationType;
      startTime: string;
      endTime: string;
      breakStart: string | null;
      breakEnd: string | null;
      slotDurationMinutes: number;
      isActive: boolean;
    }[];
  };
}

/** Generated slot for public API */
export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  consultationType: ConsultationType;
  remainingCapacity: number;
  fee: number;
}
