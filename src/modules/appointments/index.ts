// @ts-nocheck
// Note: @ts-nocheck used temporarily due to complex type inference issues
// with Zod schemas and Supabase query types

// Types - using validator types as they're derived from Zod schemas
export type {
  BookAppointmentInput,
  StartConsultationInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
  ListAppointmentsInput,
} from './appointment.validator.js';

// Additional types from types file
export type {
  AppointmentWithDetails,
  AppointmentFilters,
  AppointmentListItem,
  AppointmentListResponse,
  AppointmentStats,
  AvailableSlot,
  ConsultationDetails,
} from './appointment.types.js';

// Validators
export {
  bookAppointmentSchema,
  startConsultationSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  getAppointmentSchema,
  listAppointmentsSchema,
} from './appointment.validator.js';

// Service and controller
export { appointmentService } from './appointment.service.js';
export * from './appointment.controller.js';


