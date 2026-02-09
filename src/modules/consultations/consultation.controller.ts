import { Request, Response } from 'express';
import { consultationService } from './consultation.service.js';
import { consultationPolicy } from './consultation.policy.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import { ForbiddenError } from '../../common/errors/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  StartConsultationInput,
  ListConsultationsInput,
  CreatePrescriptionInput,
  UpdateConsultationNotesInput,
  UpdateConsultationVitalsInput,
  JoinConsultationInput
} from './consultation.validator.ts';

/**
 * Consultation Controller - Handles HTTP requests for consultations
 */

/**
 * Start a consultation
 * POST /api/v1/consultations/start
 */
export const startConsultation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as StartConsultationInput;

  // Basic role check
  if (user.role !== 'doctor' && user.role !== 'admin') {
    throw new ForbiddenError('Only doctors can start consultations');
  }

  const consultation = await consultationService.start(user.userId, user.role, data);
  return sendCreated(res, consultation, 'Consultation started');
});

/**
 * End a consultation
 * POST /api/v1/consultations/:consultationId/end
 */
export const endConsultation = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { notes } = req.body;

  const consultation = await consultationService.getById(consultationId, user.userId, user.role);
  if (!consultationPolicy.canUpdate(user, consultation)) {
    throw new ForbiddenError('You are not authorized to end this consultation');
  }

  const result = await consultationService.end(consultationId, user.userId, user.role, notes);
  return sendSuccess(res, result, 'Consultation completed');
});

/**
 * Get consultation by ID
 * GET /api/v1/consultations/:consultationId
 */
export const getConsultation = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const consultation = await consultationService.getById(consultationId, user.userId, user.role);
  return sendSuccess(res, consultation);
});

/**
 * List consultations
 * GET /api/v1/consultations
 */
export const listConsultations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query as unknown as ListConsultationsInput;
  const result = await consultationService.list(filters, user.userId, user.role);

  return sendPaginated(
    res,
    result.consultations,
    result.pagination
  );
});

/**
 * Get video call token
 * GET /api/v1/consultations/:consultationId/video-token
 */
export const getVideoToken = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const token = await consultationService.getVideoToken(consultationId, user.userId, user.role);
  return sendSuccess(res, token);
});

/**
 * Update consultation notes
 * PATCH /api/v1/consultations/:consultationId/notes
 */
export const updateNotes = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const { notes } = req.body;
  const user = (req as AuthenticatedRequest).user;

  await consultationService.updateNotes(consultationId, user.userId, notes);
  return sendSuccess(res, null, 'Notes updated');
});

/**
 * Update consultation vitals
 * PATCH /api/v1/consultations/:consultationId/vitals
 */
export const updateVitals = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const { vitals } = req.body;
  const user = (req as AuthenticatedRequest).user;

  await consultationService.updateVitals(consultationId, user.userId, vitals);
  return sendSuccess(res, null, 'Vitals updated');
});

/**
 * Get consultation status
 * GET /api/v1/consultations/:consultationId/status
 */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const status = await consultationService.getStatus(consultationId);
  return sendSuccess(res, status);
});

/**
 * Record when a user joins the consultation room
 * POST /api/v1/consultations/:consultationId/join
 */
export const joinConsultation = asyncHandler(async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await consultationService.join(consultationId, user.userId, user.role);
  return sendSuccess(res, null, 'Joined consultation');
});

/**
 * Create prescription
 * POST /api/v1/prescriptions
 */
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreatePrescriptionInput;

  const consultation = await consultationService.getById(data.consultationId, user.userId, user.role);
  if (!consultationPolicy.canCreatePrescription(user, consultation)) {
    throw new ForbiddenError('Only the treating doctor can create prescriptions');
  }

  const prescription = await consultationService.createPrescription(user.userId, data);
  return sendCreated(res, prescription, MESSAGES.CREATED);
});

/**
 * Get prescription by ID
 * GET /api/v1/prescriptions/:prescriptionId
 */
export const getPrescription = asyncHandler(async (req: Request, res: Response) => {
  const { prescriptionId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const prescription = await consultationService.getPrescription(prescriptionId, user.userId, user.role);
  return sendSuccess(res, prescription);
});

/**
 * Get patient prescriptions
 * GET /api/v1/patients/:patientId/prescriptions
 */
export const getPatientPrescriptions = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const prescriptions = await consultationService.getPatientPrescriptions(patientId, user.userId, user.role);
  return sendSuccess(res, prescriptions);
});



