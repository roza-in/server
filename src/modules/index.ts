/**
 * Modules barrel export
 * Note: Import specific items from modules to avoid naming conflicts
 */

// Auth
export { authService } from './auth/auth.service.js';
export { sendOTP, verifyOTP, refreshToken, logout, getMe, registerPatient, registerHospital, googleOAuth, logoutAll, updateProfile } from './auth/auth.controller.js';

// Hospitals
export { hospitalService } from './hospitals/hospital.service.js';
export { hospitalRepository } from './hospitals/hospital.repository.js';
export { 
  getHospital, 
  getHospitalBySlug,
  updateHospital, 
  listHospitals, 
  verifyHospital, 
  getMyHospital,
  addDoctor,
  getHospitalDoctors,
  getHospitalStats
} from './hospitals/hospital.controller.js';

// Doctors
export { doctorService } from './doctors/doctor.service.js';
export { doctorRepository } from './doctors/doctor.repository.js';
export { 
  getDoctor, 
  getDoctorProfile,
  updateDoctor, 
  listDoctors, 
  getMyDoctorProfile,
  updateDoctorStatus,
  getDoctorAvailability,
  getDoctorStats
} from './doctors/doctor.controller.js';

// Appointments
export { appointmentService } from './appointments/appointment.service.js';
export { appointmentRepository } from './appointments/appointment.repository.js';
export { 
  bookAppointment, 
  getAppointment, 
  listAppointments, 
  updateAppointmentStatus, 
  cancelAppointment, 
  rescheduleAppointment,
  getTodayAppointments,
  checkInAppointment,
  startConsultation as startAppointmentConsultation,
  completeConsultation,
  markNoShow,
  rateAppointment
} from './appointments/appointment.controller.js';

// Schedules
export { scheduleService } from './schedules/schedule.service.js';
export { 
  createSchedule, 
  updateSchedule, 
  getDoctorSchedules, 
  deleteSchedule, 
  createOverride, 
  getOverrides,
  bulkCreateSchedules,
  deleteOverride
} from './schedules/schedule.controller.js';

// Payments
export { paymentService } from './payments/payment.service.js';
export { 
  createOrder, 
  verifyPayment, 
  getPayment, 
  listPayments, 
  refundPayment,
  getPaymentStats,
  handleWebhook 
} from './payments/payment.controller.js';

// Consultations
export { consultationService } from './consultations/consultation.service.js';
export { 
  startConsultation,
  endConsultation, 
  getConsultation, 
  listConsultations, 
  createPrescription, 
  getPatientPrescriptions,
  getPrescription,
  getVideoToken
} from './consultations/consultation.controller.js';

// Notifications
export { notificationService } from './notifications/notification.service.js';
export { 
  sendNotification, 
  sendBulkNotification, 
  listNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getPreferences, 
  updatePreferences, 
  registerDevice, 
  unregisterDevice 
} from './notifications/notification.controller.js';

// Health Records
export { healthRecordsService } from './health-records/health-records.service.js';
export {
  // Family Members
  createFamilyMember,
  getFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
  deleteFamilyMember,
  // Documents
  uploadDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  // Vitals
  createVitalRecord,
  getVitalRecord,
  listVitals,
  deleteVitalRecord,
  getVitalTrends,
  // Medications
  createMedication,
  getMedication,
  listMedications,
  updateMedication,
  deleteMedication,
  recordMedicationAction,
  getUpcomingReminders,
  // Allergies
  createAllergy,
  getAllergy,
  listAllergies,
  updateAllergy,
  deleteAllergy,
  // Health Summary
  getHealthSummary,
  getFamilyHealthSummary
} from './health-records/health-records.controller.js';
