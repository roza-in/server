/**
 * Modules barrel export
 * Note: Import specific items from modules to avoid naming conflicts
 */

// Auth
export { authService } from './auth/auth.service.js';
export { authController } from './auth/auth.controller.js';



// Hospitals
export { hospitalService } from './hospitals/hospital.service.js';
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
export {
  bookAppointment,
  getAppointment,
  listAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  rescheduleAppointment,
  getTodayAppointments,
  markNoShow,
  rateAppointment
} from './appointments/appointment.controller.js';

// Schedules
export { scheduleService } from './schedules/schedule.service.js';
export { slotService } from './schedules/slot.service.js';
export {
  createSchedule,
  updateSchedule,
  getDoctorSchedules,
  deleteSchedule,
  createOverride,
  getOverrides,
  bulkCreateSchedules,
  deleteOverride,
  getAvailableSlots,
  regenerateSlots,
  generateAllSlots,
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
  getVideoToken
} from './consultations/consultation.controller.js';

// Prescriptions
export { prescriptionService } from './prescriptions/prescription.service.js';
export {
  createPrescription,
  getPrescription,
  listPrescriptions,
  getMyPrescriptions,
  signPrescription
} from './prescriptions/index.js';

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

// Reception
export { receptionService } from './reception/reception.service.js';
export {
  getQueue,
  checkInPatient,
  markNoShow as markNoShowReception,
  createWalkInBooking,
  searchPatients,
  registerPatient,
  recordCashPayment,
} from './reception/reception.controller.js';


