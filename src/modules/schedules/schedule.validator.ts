// @ts-nocheck
import { z } from 'zod';
import { uuidSchema, consultationTypeSchema } from '../../common/validators.js';

/**
 * Schedule validators using Zod
 */

// Create schedule schema
export const createScheduleSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    slotDuration: z.number().min(5).max(120).default(15),
    consultationType: consultationTypeSchema.default('both'),
  }),
});

// Bulk create schedules schema
export const bulkCreateSchedulesSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    schedules: z.array(z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotDuration: z.number().min(5).max(120).default(15),
      consultationType: consultationTypeSchema.default('both'),
    })).min(1).max(21), // Max 3 per day
  }),
});

// Update schedule schema
export const updateScheduleSchema = z.object({
  params: z.object({
    scheduleId: uuidSchema,
  }),
  body: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    slotDuration: z.number().min(5).max(120).optional(),
    consultationType: consultationTypeSchema.optional(),
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

// Create override schema
export const createOverrideSchema = z.object({
  params: z.object({
    doctorId: uuidSchema,
  }),
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isAvailable: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    reason: z.string().max(255).optional(),
  }).refine(data => {
    // If available, must have times
    if (data.isAvailable && (!data.startTime || !data.endTime)) {
      return false;
    }
    return true;
  }, {
    message: 'Start time and end time are required when marking as available',
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
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

// Export types
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>['body'];
export type BulkCreateSchedulesInput = z.infer<typeof bulkCreateSchedulesSchema>['body'];
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>['body'];
export type CreateOverrideInput = z.infer<typeof createOverrideSchema>['body'];

