// Types
export type {
  DoctorRow,
  DoctorProfile,
  DoctorListItem,
  DoctorPublicProfile,
  DoctorDayAvailability,
  TimeSlot,
  ScheduleInput,
  ScheduleOverrideInput,
  DoctorFilters,
  DoctorListResponse,
  DoctorStats,
  DoctorDashboard,
  UpcomingAppointment,
  RecentPatient,
  UpdateDoctorInput,
  UpdateDoctorVerificationInput,
} from './doctor.types.js';

// Validators & Input Types
export {
  getDoctorSchema,
  listDoctorsSchema,
  updateDoctorSchema,
  createDoctorSchema,
  getDoctorAvailabilitySchema,
  doctorStatsSchema,
  updateDoctorStatusSchema,
} from './doctor.validator.js';

export type {
  GetDoctorInput,
  ListDoctorsInput,
  UpdateDoctorBody,
  GetDoctorAvailabilityInput,
  DoctorStatsInput,
  UpdateDoctorStatusInput,
  CreateDoctorInput,
} from './doctor.validator.js';

// Service
export { doctorService } from './doctor.service.js';

// Controller
export {
  addDoctor,
  getDoctor,
  getDoctorProfile,
  updateDoctor,
  updateDoctorStatus,
  listDoctors,
  getDoctorStats,
  getDoctorAvailability,
  getDoctorSchedule,
  getSpecializations,
  getMyDoctorProfile,
} from './doctor.controller.js';

