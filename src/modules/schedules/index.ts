// Re-export types (avoid duplicates from validator)
export type {
    DayOfWeek,
    ConsultationType,
    ScheduleOverrideType,
    DoctorSchedule,
    ScheduleOverride,
    AppointmentSlot,
    WeeklySchedule,
    AvailableSlot,
} from './schedule.types.js';

// Export validators (types are inferred, not re-exported)
export {
    createScheduleSchema,
    bulkCreateSchedulesSchema,
    updateScheduleSchema,
    deleteScheduleSchema,
    getDoctorSchedulesSchema,
    createOverrideSchema,
    deleteOverrideSchema,
    getOverridesSchema,
    getAvailableSlotsSchema,
} from './schedule.validator.js';

// Export services
export { scheduleService } from './schedule.service.js';
export { slotService } from './slot.service.js';

// Export controller functions
export {
    createSchedule,
    updateSchedule,
    getDoctorSchedules,
    deleteSchedule,
    bulkCreateSchedules,
    createOverride,
    getOverrides,
    deleteOverride,
    getAvailableSlots,
    regenerateSlots,
    generateAllSlots,
} from './schedule.controller.js';
