import { Router } from 'express';
import {
  startConsultation,
  endConsultation,
  getConsultation,
  listConsultations,
  getVideoToken,
  updateNotes,
  updateVitals,
  getStatus,
  joinConsultation
} from './consultation.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';

import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  startConsultationSchema,
  endConsultationSchema,
  listConsultationsSchema,
  getConsultationSchema,
  getVideoTokenSchema,
  updateConsultationNotesSchema,
  updateConsultationVitalsSchema,
  getConsultationStatusSchema,
  joinConsultationSchema
} from './consultation.validator.js';

const router = Router();

/**
 * @route POST /api/v1/consultations/start
 * @desc Start a consultation
 * @access Private (doctor)
 */
router.post(
  '/start',
  authMiddleware,
  roleGuard('doctor'),
  validate(startConsultationSchema),
  idempotencyMiddleware(),
  startConsultation
);

/**
 * @route POST /api/v1/consultations/:consultationId/end
 * @desc End a consultation
 * @access Private (doctor)
 */
router.post(
  '/:consultationId/end',
  authMiddleware,
  roleGuard('doctor'),
  validate(endConsultationSchema),
  idempotencyMiddleware(),
  endConsultation
);

/**
 * @route GET /api/v1/consultations
 * @desc List consultations
 * @access Private
 */
router.get(
  '/',
  authMiddleware,
  validate(listConsultationsSchema),
  listConsultations
);

/**
 * @route GET /api/v1/consultations/:consultationId
 * @desc Get consultation by ID
 * @access Private
 */
router.get(
  '/:consultationId',
  authMiddleware,
  validate(getConsultationSchema),
  getConsultation
);

/**
 * @route GET /api/v1/consultations/:consultationId/video-token
 * @desc Get video call token for consultation
 * @access Private (doctor, patient)
 */
router.get(
  '/:consultationId/video-token',
  authMiddleware,
  roleGuard('doctor', 'patient'),
  validate(getVideoTokenSchema),
  getVideoToken
);

/**
 * @route PATCH /api/v1/consultations/:consultationId/notes
 * @desc Update consultation notes
 * @access Private (doctor)
 */
router.patch(
  '/:consultationId/notes',
  authMiddleware,
  roleGuard('doctor'),
  validate(updateConsultationNotesSchema),
  updateNotes
);

/**
 * @route PATCH /api/v1/consultations/:consultationId/vitals
 * @desc Update consultation vitals
 * @access Private (doctor)
 */
router.patch(
  '/:consultationId/vitals',
  authMiddleware,
  roleGuard('doctor'),
  validate(updateConsultationVitalsSchema),
  updateVitals
);

/**
 * @route GET /api/v1/consultations/:consultationId/status
 * @desc Get consultation status
 * @access Private (doctor, patient)
 */
router.get(
  '/:consultationId/status',
  authMiddleware,
  validate(getConsultationStatusSchema),
  getStatus
);

/**
 * @route POST /api/v1/consultations/:consultationId/join
 * @desc Record user join time
 * @access Private
 */
router.post(
  '/:consultationId/join',
  authMiddleware,
  validate(joinConsultationSchema),
  joinConsultation
);

export const consultationRoutes = router;

export default router;

