import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';
import {
    getQueue,
    checkInPatient,
    markNoShow,
    createWalkInBooking,
    searchPatients,
    registerPatient,
    recordCashPayment,
    checkInWithPayment,
    getPrescription,
} from './reception.controller.js';
import {
    queueQuerySchema,
    checkInSchema,
    noShowSchema,
    walkInBookingSchema,
    patientSearchSchema,
    registerPatientSchema,
    cashPaymentSchema,
    checkInWithPaymentSchema,
} from './reception.validator.js';

const router = Router();

// All routes require authentication and reception/hospital/admin role
router.use(authMiddleware);
router.use(roleGuard('reception', 'hospital', 'admin'));

/**
 * @route GET /api/v1/reception/queue
 * @desc Get today's appointment queue for the hospital
 * @access Private (reception, hospital, admin)
 */
router.get('/queue', validate(queueQuerySchema), getQueue);

router.patch(
    '/appointments/:appointmentId/check-in',
    validate(checkInSchema),
    checkInPatient
);

/**
 * @route PATCH /api/v1/reception/appointments/:appointmentId/check-in-with-payment
 * @desc Check in a patient and record payment at reception
 * @access Private (reception, hospital, admin)
 */
router.patch(
    '/appointments/:appointmentId/check-in-with-payment',
    validate(checkInWithPaymentSchema),
    checkInWithPayment
);

/**
 * @route PATCH /api/v1/reception/appointments/:appointmentId/no-show
 * @desc Mark an appointment as no-show
 * @access Private (reception, hospital, admin)
 */
router.patch(
    '/appointments/:appointmentId/no-show',
    validate(noShowSchema),
    markNoShow
);

/**
 * @route GET /api/v1/reception/appointments/:appointmentId/prescription
 * @desc Get prescription details for printing
 * @access Private (reception, hospital, admin)
 */
router.get(
    '/appointments/:appointmentId/prescription',
    getPrescription
);

/**
 * @route POST /api/v1/reception/walk-in
 * @desc Create a walk-in booking with cash payment
 * @access Private (reception, hospital, admin)
 */
router.post(
    '/walk-in',
    validate(walkInBookingSchema),
    idempotencyMiddleware(),
    createWalkInBooking
);

/**
 * @route GET /api/v1/reception/patients/search
 * @desc Search patients by phone or name
 * @access Private (reception, hospital, admin)
 */
router.get('/patients/search', validate(patientSearchSchema), searchPatients);

/**
 * @route POST /api/v1/reception/patients
 * @desc Register a new walk-in patient
 * @access Private (reception, hospital, admin)
 */
router.post(
    '/patients',
    validate(registerPatientSchema),
    idempotencyMiddleware(),
    registerPatient
);

/**
 * @route POST /api/v1/reception/payments/cash
 * @desc Record a cash payment for an appointment
 * @access Private (reception, hospital, admin)
 */
router.post(
    '/payments/cash',
    validate(cashPaymentSchema),
    idempotencyMiddleware(),
    recordCashPayment
);

export const receptionRoutes = router;
export default router;
