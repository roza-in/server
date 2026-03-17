// Re-export types
export type {
    DayOfWeek,
    ConsultationType,
    ScheduleOverrideType,
    DoctorScheduleDTO,
    ScheduleOverrideDTO,
    AppointmentSlotDTO,
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

// Export routes
export { scheduleRoutes } from './schedule.routes.js';

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
