export * from './hospital.types.js';
export * from './hospital.validator.js';
export { hospitalService } from './hospital.service.js';
export { hospitalPolicy } from './hospital.policy.js';
export { hospitalRoutes } from './hospital.routes.js';
export {
  getHospital,
  getHospitalBySlug,
  listHospitals,
  getMyHospital,
  updateHospital,
  getHospitalPatients,
  getHospitalAppointments,
  getHospitalPayments,
  getHospitalInvoices,
  addDoctor,
  getHospitalDoctors,
  getHospitalStats,
  verifyHospital,
  getHospitalDashboard,
  updateDoctorSettings,
  addHospitalStaff,
  listHospitalStaff,
  removeHospitalStaff,
} from './hospital.controller.js';


