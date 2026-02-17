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
export { scheduleRoutes } from './schedules/schedule.routes.js';
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

// Refunds
export { refundService, refundRoutes } from './refunds/index.js';
export type {
  Refund,
  RefundWithRelations,
  RefundFilters,
  CreateRefundInput,
  ProcessRefundInput,
  RefundStats,
} from './refunds/index.js';

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
export { prescriptionService } from './prescriptions/index.js';
export { prescriptionRoutes } from './prescriptions/index.js';
export type {
  Prescription,
  PrescriptionWithRelations,
  PrescriptionListItem,
  CreatePrescriptionInput,
  PrescriptionFilters,
  Medication,
} from './prescriptions/index.js';

// Ratings
export { ratingService, ratingRoutes } from './ratings/index.js';
export type {
  Rating,
  RatingWithRelations,
  RatingListItem,
  RatingFilters,
  CreateRatingInput,
  ModerateRatingInput,
  RatingStats,
} from './ratings/index.js';

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
export { receptionService, receptionRoutes } from './reception/index.js';
export type {
  QueueAppointment,
  QueueResponse,
  WalkInBookingInput,
  PatientSearchResult,
  CashPaymentInput,
  PrescriptionResponse,
} from './reception/index.js';

// Support
export { supportService, supportRoutes } from './support/index.js';
export {
  createTicket,
  getMyTickets,
  listTickets,
  getTicket,
  replyToTicket,
  updateTicket,
  resolveTicket,
  closeTicket,
  getTicketStats,
  rateTicket,
} from './support/support.controller.js';

// Settlements
export { settlementService, settlementRoutes } from './settlements/index.js';
export {
  listSettlements,
  getSettlement,
  getMySettlements,
  calculateSettlement,
  approveSettlement,
  initiatePayout,
  completeSettlement,
  getSettlementStats,
} from './settlements/settlement.controller.js';
export type {
  SettlementWithRelations,
  SettlementListResponse,
  SettlementStatsResponse,
  SettlementFilters,
  CalculateSettlementInput,
  CompleteSettlementInput,
} from './settlements/index.js';
