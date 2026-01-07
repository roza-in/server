import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  startConsultation,
  endConsultation,
  getConsultation,
  listConsultations,
  getVideoToken,
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
} from '../modules/consultations/consultation.controller.js';

const router = Router();

/**
 * @route POST /api/v1/consultations/start
 * @desc Start a consultation
 * @access Private (doctor)
 */
router.post(
  '/start',
  authenticate,
  requireRole('doctor'),
  startConsultation
);

/**
 * @route POST /api/v1/consultations/:consultationId/end
 * @desc End a consultation
 * @access Private (doctor)
 */
router.post(
  '/:consultationId/end',
  authenticate,
  requireRole('doctor'),
  endConsultation
);

/**
 * @route GET /api/v1/consultations
 * @desc List consultations
 * @access Private
 */
router.get('/', authenticate, listConsultations);

/**
 * @route GET /api/v1/consultations/:consultationId
 * @desc Get consultation by ID
 * @access Private
 */
router.get(
  '/:consultationId',
  authenticate,
  getConsultation
);

/**
 * @route GET /api/v1/consultations/:consultationId/video-token
 * @desc Get video call token for consultation
 * @access Private (doctor, patient)
 */
router.get(
  '/:consultationId/video-token',
  authenticate,
  requireRole('doctor', 'patient'),
  getVideoToken
);

// Prescription routes
/**
 * @route POST /api/v1/prescriptions
 * @desc Create a prescription
 * @access Private (doctor)
 */
router.post(
  '/prescriptions',
  authenticate,
  requireRole('doctor'),
  createPrescription
);

/**
 * @route GET /api/v1/prescriptions/:prescriptionId
 * @desc Get prescription by ID
 * @access Private
 */
router.get(
  '/prescriptions/:prescriptionId',
  authenticate,
  getPrescription
);

/**
 * @route GET /api/v1/patients/:patientId/prescriptions
 * @desc Get patient's prescriptions
 * @access Private
 */
router.get(
  '/patients/:patientId/prescriptions',
  authenticate,
  getPatientPrescriptions
);

export const consultationRoutes = router;
