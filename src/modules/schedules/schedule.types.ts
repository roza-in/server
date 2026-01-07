/**
 * Types for schedules module
 */

// Schedule type
export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  slotDuration: number;
  consultationType: 'online' | 'in_person' | 'both';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Schedule override (for specific dates)
export interface ScheduleOverride {
  id: string;
  doctorId: string;
  date: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Schedule input
export interface CreateScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  consultationType?: 'online' | 'in_person' | 'both';
}

// Bulk schedule input
export interface BulkScheduleInput {
  schedules: CreateScheduleInput[];
}

// Override input
export interface CreateOverrideInput {
  date: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

// Weekly schedule view
export interface WeeklySchedule {
  [day: number]: {
    dayName: string;
    schedules: {
      id: string;
      startTime: string;
      endTime: string;
      slotDuration: number;
      consultationType: string;
    }[];
  };
}
