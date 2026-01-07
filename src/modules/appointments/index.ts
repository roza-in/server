// Types - using validator types as they're derived from Zod schemas
export type {
  BookAppointmentInput,
  StartConsultationInput,
  EndConsultationInput,
  CreatePrescriptionInput,
  UpdateAppointmentInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
} from './appointment.validator.js';

// Additional types from types file
export type {
  Appointment,
  AppointmentWithDetails,
  AppointmentFilters,
  AppointmentTimeSlot,
  SlotAvailability,
  AppointmentStats,
} from './appointment.types.js';

// Validators
export {
  bookAppointmentSchema,
  startConsultationSchema,
  endConsultationSchema,
  createPrescriptionSchema,
  updateAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  getAppointmentSchema,
  listAppointmentsSchema,
} from './appointment.validator.js';

// Service and controller
export * from './appointment.repository.js';
export * from './appointment.service.js';
export * from './appointment.controller.js';
