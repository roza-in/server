import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { rateLimitBooking } from '../middlewares/rate-limit.middleware.js';
import {
  getAppointment,
  listAppointments,
  cancelAppointment,
  rescheduleAppointment,
  rateAppointment,
} from '../modules/appointments/appointment.controller.js';

const router = Router();

/**
 * @route GET /api/v1/appointments
 * @desc List appointments (filtered by role)
 * @access Private
 */
router.get('/', authenticate, listAppointments);

/**
 * @route GET /api/v1/appointments/:appointmentId
 * @desc Get appointment by ID
 * @access Private (involved parties only)
 */
router.get('/:appointmentId', authenticate, getAppointment);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/cancel
 * @desc Cancel an appointment
 * @access Private (patient, doctor, hospital, admin)
 */
router.patch(
  '/:appointmentId/cancel',
  authenticate,
  cancelAppointment
);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/reschedule
 * @desc Reschedule appointment
 * @access Private
 */
router.patch(
  '/:appointmentId/reschedule',
  authenticate,
  rescheduleAppointment
);

/**
 * @route POST /api/v1/appointments/:appointmentId/rate
 * @desc Rate a completed appointment
 * @access Private (patient)
 */
router.post(
  '/:appointmentId/rate',
  authenticate,
  requireRole('patient'),
  rateAppointment
);

export const appointmentRoutes = router;
