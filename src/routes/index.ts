import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { hospitalRoutes } from './hospital.routes.js';
import { doctorRoutes } from './doctor.routes.js';
import { appointmentRoutes } from './appointment.routes.js';
import { scheduleRoutes } from './schedule.routes.js';
import { paymentRoutes } from './payment.routes.js';
import { consultationRoutes } from './consultation.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { healthRoutes as serverHealthRoutes } from '../health/index.js';
import healthRecordsRoutes from './health.routes.js';

const router = Router();

// API v1 routes
router.use('/auth', authRoutes);
router.use('/hospitals', hospitalRoutes);
router.use('/doctors', doctorRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/payments', paymentRoutes);
router.use('/consultations', consultationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/health', healthRecordsRoutes);

// Server health check routes (at /api/v1/server-health)
router.use('/server-health', serverHealthRoutes);

export const apiRoutes = router;
export {
  authRoutes,
  hospitalRoutes,
  doctorRoutes,
  appointmentRoutes,
  scheduleRoutes,
  paymentRoutes,
  consultationRoutes,
  notificationRoutes,
  healthRecordsRoutes,
};
