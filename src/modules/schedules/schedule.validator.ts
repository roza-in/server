import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

/**
 * Schedule validators using Zod
 * Hospital-managed doctor schedules
 */

// Day of week enum matching database
const dayOfWeekSchema = z.enum([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]);

// Consultation type matching database
const consultationTypeSchema = z.enum(['online', 'in_person', 'walk_in']);

// Override type matching database
const overrideTypeSchema = z.enum(['holiday', 'leave', 'emergency', 'special_hours']);

// Time format HH:MM
const timeSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format, use HH:MM');

// Date format YYYY-MM-DD
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, use YYYY-MM-DD');

// ============================================================
// SCHEDULE SCHEMAS
// ============================================================

// Create schedule schema
// NOTE: Consultation types are inherited from doctor.consultation_types (global setting)
export const createScheduleSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    dayOfWeek: dayOfWeekSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    breakStart: timeSchema.optional(),
    breakEnd: timeSchema.optional(),
    slotDurationMinutes: z.number().min(5).max(120).optional(),
    maxPatientsPerSlot: z.number().min(1).max(10).optional(),
  }).refine(data => data.startTime < data.endTime, {
    message: 'Start time must be before end time',
  }).refine(data => {
    if (data.breakStart && data.breakEnd) {
      return data.breakStart < data.breakEnd;
    }
    return true;
  }, {
    message: 'Break start must be before break end',
  }),
});

// Bulk create schedules schema
export const bulkCreateSchedulesSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    schedules: z.array(z.object({
      dayOfWeek: dayOfWeekSchema,
      startTime: timeSchema,
      endTime: timeSchema,
      breakStart: timeSchema.optional(),
      breakEnd: timeSchema.optional(),
      slotDurationMinutes: z.number().min(5).max(120).optional(),
      maxPatientsPerSlot: z.number().min(1).max(10).optional(),
    })).min(1).max(21), // Max 3 per day
  }),
});

// Update schedule schema
export const updateScheduleSchema = z.object({
  params: z.object({
    scheduleId: uuidSchema,
  }),
  body: z.object({
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    breakStart: timeSchema.nullable().optional(),
    breakEnd: timeSchema.nullable().optional(),
    slotDurationMinutes: z.number().min(5).max(120).optional(),
    maxPatientsPerSlot: z.number().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  }),
});

// Delete schedule schema
export const deleteScheduleSchema = z.object({
  params: z.object({
    scheduleId: uuidSchema,
  }),
});

// Get doctor schedules schema
export const getDoctorSchedulesSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
});

// ============================================================
// OVERRIDE SCHEMAS
// ============================================================

// Create override schema
export const createOverrideSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    overrideDate: dateSchema,
    overrideType: overrideTypeSchema,
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    reason: z.string().max(255).optional(),
  }).refine(data => {
    // If special_hours, must have times
    if (data.overrideType === 'special_hours') {
      return data.startTime && data.endTime;
    }
    return true;
  }, {
    message: 'Start time and end time are required for special hours',
  }),
});

// Delete override schema
export const deleteOverrideSchema = z.object({
  params: z.object({
    overrideId: uuidSchema,
  }),
});

// Get overrides schema
export const getOverridesSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  query: z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }),
});

// ============================================================
// SLOT SCHEMAS
// ============================================================

// Get available slots schema
export const getAvailableSlotsSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  query: z.object({
    date: dateSchema,
    consultationType: consultationTypeSchema.optional(),
  }),
});

// ============================================================
// EXPORTED TYPES
// ============================================================

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>['body'];
export type BulkCreateSchedulesInput = z.infer<typeof bulkCreateSchedulesSchema>['body'];
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>['body'];
export type CreateOverrideInput = z.infer<typeof createOverrideSchema>['body'];
export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>['query'];
