/**
 * Types for schedules module
 * Hospital-managed doctor schedules and slot generation
 */

// Day of week enum matching database
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Consultation type matching database
export type ConsultationType = 'online' | 'in_person' | 'walk_in';

// Schedule override type matching database
export type ScheduleOverrideType = 'holiday' | 'leave' | 'emergency' | 'special_hours';

// Doctor schedule (weekly recurring)
// NOTE: Consultation types are inherited from doctor.consultation_types (global setting)
export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
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

// Schedule override (for specific dates)
export interface ScheduleOverride {
  id: string;
  doctorId: string;
  overrideDate: string;
  overrideType: ScheduleOverrideType;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: string;
}

// Appointment slot (generated from schedules)
export interface AppointmentSlot {
  id: string;
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  consultationType: ConsultationType;
  maxBookings: number;
  currentBookings: number;
  isAvailable: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  createdAt: string;
}

// Input types
// NOTE: Consultation types come from doctor.consultation_types, not per-schedule
export interface CreateScheduleInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  slotDurationMinutes?: number;
  maxPatientsPerSlot?: number;
}

export interface UpdateScheduleInput {
  startTime?: string;
  endTime?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  slotDurationMinutes?: number;
  maxPatientsPerSlot?: number;
  isActive?: boolean;
}

export interface BulkScheduleInput {
  schedules: CreateScheduleInput[];
}

export interface CreateOverrideInput {
  overrideDate: string;
  overrideType: ScheduleOverrideType;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

// Weekly schedule view
export interface WeeklySchedule {
  [day: string]: {
    dayName: string;
    schedules: {
      id: string;
      startTime: string;
      endTime: string;
      breakStart: string | null;
      breakEnd: string | null;
      slotDurationMinutes: number;
      isActive: boolean;
    }[];
  };
}

// Generated slot for public API
export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  consultationType: ConsultationType;
  remainingCapacity: number;
  fee: number;
}
