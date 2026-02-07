import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import hospitalRoutes from '../modules/hospitals/hospital.routes.js';
import doctorRoutes from '../modules/doctors/doctor.routes.js';
import appointmentRoutes from '../modules/appointments/appointment.routes.js';
import scheduleRoutes from '../modules/schedules/schedule.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import consultationRoutes from '../modules/consultations/consultation.routes.js';
import prescriptionRoutes from '../modules/prescriptions/prescription.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import pharmacyRoutes from '../modules/pharmacy/pharmacy.routes.js';
import healthRoutes from '../modules/health-records/health.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import supportRoutes from '../modules/support/support.routes.js';
import uploadRoutes from '../modules/uploads/upload.routes.js';
import ratingRoutes from '../modules/ratings/rating.routes.js';
import refundRoutes from '../modules/refunds/refund.routes.js';
import settlementRoutes from '../modules/settlements/settlement.routes.js';
import patientRoutes from '../modules/patients/patient.routes.js';
import receptionRoutes from '../modules/reception/reception.routes.js';

const router = Router();

// Core Modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/doctors', doctorRoutes);

// Healthcare Operations
router.use('/appointments', appointmentRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/consultations', consultationRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/health-records', healthRoutes);
router.use('/patients', patientRoutes);
router.use('/reception', receptionRoutes);

// Commerce & Finance
router.use('/payments', paymentRoutes);
router.use('/refunds', refundRoutes);
router.use('/settlements', settlementRoutes);
router.use('/pharmacy', pharmacyRoutes);

// Utilities & Communication
router.use('/notifications', notificationRoutes);
router.use('/ratings', ratingRoutes);
router.use('/support', supportRoutes);
router.use('/uploads', uploadRoutes);

// Admin
router.use('/admin', adminRoutes);

export { router as routes };
export default router;
