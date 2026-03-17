/**
 * Database Repositories - Central Export
 *
 * All repository singletons for the ROZX healthcare platform.
 * Each repo wraps Supabase admin client via BaseRepository<T>.
 */

// Core entities
export { userRepository } from './user.repo.js';
export { sessionRepository } from './session.repo.js';
export { otpRepository } from './otp.repo.js';

// Medical entities
export { hospitalRepository } from './hospital.repo.js';
export { doctorRepository } from './doctor.repo.js';
export { specializationRepository } from './specialization.repo.js';
export { familyMemberRepository } from './family-member.repo.js';

// Appointments & Consultations
export { appointmentRepository } from './appointment.repo.js';
export { consultationRepository } from './consultation.repo.js';
export { waitlistRepository } from './waitlist.repo.js';

// Payments & Settlements
export { paymentRepository } from './payment.repo.js';
export { refundRepository } from './refund.repo.js';
export { settlementRepository } from './settlement.repo.js';
export { creditRepository } from './credit.repo.js';

// Pharmacy
export { pharmacyRepository } from './pharmacy.repo.js';
export { medicineRepository } from './medicine.repo.js';
export { medicineOrderRepository } from './medicine-order.repo.js';
export { medicineReturnRepository } from './medicine-return.repo.js';
export { pharmacySettlementRepository } from './pharmacy-settlement.repo.js';

// Prescriptions
export { prescriptionRepository } from './prescription.repo.js';

// Notifications
export { notificationRepository } from './notification.repo.js';
export { notificationQueueRepository } from './notification-queue.repo.js';

// Hospital Management
export { hospitalAnnouncementRepository } from './hospital-announcement.repo.js';

// Ratings
export { ratingHelpfulnessRepository } from './rating-helpfulness.repo.js';

// Patient Health Records
export { patientMedicationRepository } from './patient-medication.repo.js';
export { patientAllergyRepository } from './patient-allergy.repo.js';
export { patientConditionRepository } from './patient-condition.repo.js';

// Reports
export { scheduledReportRepository } from './scheduled-report.repo.js';
