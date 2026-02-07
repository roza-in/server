import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';
import {
  bookAppointment,
  cancelAppointment,
  getAppointment,
  listAppointments,
  rateAppointment,
  rescheduleAppointment,
  getConsultationFee,
  checkAvailability
} from './appointment.controller.js';
import {
  bookAppointmentSchema,
  listAppointmentsSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  rateAppointmentSchema,
  getAppointmentSchema,
  feeBreakdownSchema,
  checkAvailabilitySchema
} from './appointment.validator.js';
import { validate } from '../../middlewares/validate.middleware.js';

const router = Router();

/**
 * @route GET /api/v1/appointments/fee-breakdown
 * @desc Get consultation fee breakdown
 * @access Public
 */
router.get('/fee-breakdown', validate(feeBreakdownSchema), getConsultationFee);

/**
 * @route GET /api/v1/appointments/check-availability
 * @desc Check doctor availability
 * @access Public
 */
router.get('/check-availability', validate(checkAvailabilitySchema), checkAvailability);

/**
 * @route POST /api/v1/appointments
 * @desc Book a new appointment
 * @access Private (patient)
 */
router.post(
  '/',
  authMiddleware,
  roleGuard('patient', 'reception', 'admin'),
  validate(bookAppointmentSchema),
  idempotencyMiddleware(),
  bookAppointment
);

/**
 * @route GET /api/v1/appointments
 * @desc List appointments (filtered by role)
 * @access Private
 */
router.get('/', authMiddleware, validate(listAppointmentsSchema), listAppointments);

/**
 * @route GET /api/v1/appointments/:appointmentId
 * @desc Get appointment by ID
 * @access Private (involved parties only)
 */
router.get('/:appointmentId', authMiddleware, validate(getAppointmentSchema), getAppointment);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/cancel
 * @desc Cancel an appointment
 * @access Private (patient, doctor, hospital, admin)
 */
router.patch(
  '/:appointmentId/cancel',
  authMiddleware,
  validate(cancelAppointmentSchema),
  idempotencyMiddleware(),
  cancelAppointment
);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/reschedule
 * @desc Reschedule appointment
 * @access Private
 */
router.patch(
  '/:appointmentId/reschedule',
  authMiddleware,
  validate(rescheduleAppointmentSchema),
  idempotencyMiddleware(),
  rescheduleAppointment
);

/**
 * @route POST /api/v1/appointments/:appointmentId/rate
 * @desc Rate a completed appointment
 * @access Private (patient)
 */
router.post(
  '/:appointmentId/rate',
  authMiddleware,
  roleGuard('patient'),
  validate(rateAppointmentSchema),
  idempotencyMiddleware(),
  rateAppointment
);

export const appointmentRoutes = router;
export default router;

