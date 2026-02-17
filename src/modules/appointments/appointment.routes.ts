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
  checkAvailability,
  updateAppointmentStatus,
  markNoShow,
  getTodayAppointments
} from './appointment.controller.js';
import {
  joinWaitlist,
  getMyWaitlist,
  cancelWaitlist,
  getWaitingPatients
} from './waitlist.controller.js';
import {
  bookAppointmentSchema,
  listAppointmentsSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  rateAppointmentSchema,
  getAppointmentSchema,
  feeBreakdownSchema,
  checkAvailabilitySchema,
  updateAppointmentStatusSchema,
  checkInSchema,
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
 * @route GET /api/v1/appointments/today
 * @desc Get today's appointments (for dashboard)
 * @access Private
 */
router.get('/today', authMiddleware, getTodayAppointments);

// ============================================================================
// WAITLIST (I1 — appointment_waitlist table)
// Must be BEFORE /:appointmentId to avoid param capture
// ============================================================================

/**
 * @route POST /api/v1/appointments/waitlist
 * @desc Join waitlist for a doctor's slot
 * @access Private (patient)
 */
router.post('/waitlist', authMiddleware, roleGuard('patient'), joinWaitlist);

/**
 * @route GET /api/v1/appointments/waitlist
 * @desc Get my waitlist entries
 * @access Private (patient)
 */
router.get('/waitlist', authMiddleware, roleGuard('patient'), getMyWaitlist);

/**
 * @route GET /api/v1/appointments/waitlist/doctor/:doctorId
 * @desc Get waiting patients for a doctor (doctor/hospital view)
 * @access Private (doctor, hospital, admin)
 */
router.get('/waitlist/doctor/:doctorId', authMiddleware, roleGuard('doctor', 'hospital', 'admin'), getWaitingPatients);

/**
 * @route DELETE /api/v1/appointments/waitlist/:entryId
 * @desc Cancel a waitlist entry
 * @access Private (patient)
 */
router.delete('/waitlist/:entryId', authMiddleware, roleGuard('patient'), cancelWaitlist);

/**
 * @route GET /api/v1/appointments/:appointmentId
 * @desc Get appointment by ID
 * @access Private (involved parties only)
 */
router.get('/:appointmentId', authMiddleware, validate(getAppointmentSchema), getAppointment);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/status
 * @desc Update appointment status
 * @access Private (doctor, hospital, admin)
 */
router.patch(
  '/:appointmentId/status',
  authMiddleware,
  roleGuard('doctor', 'hospital', 'reception', 'admin'),
  validate(updateAppointmentStatusSchema),
  idempotencyMiddleware(),
  updateAppointmentStatus
);

/**
 * @route PATCH /api/v1/appointments/:appointmentId/no-show
 * @desc Mark appointment as no-show
 * @access Private (doctor, hospital, admin)
 */
router.patch(
  '/:appointmentId/no-show',
  authMiddleware,
  roleGuard('doctor', 'hospital', 'reception', 'admin'),
  validate(getAppointmentSchema),
  idempotencyMiddleware(),
  markNoShow
);

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
