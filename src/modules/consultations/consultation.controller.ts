// @ts-nocheck
import { Request, Response } from 'express';
import { consultationService } from './consultation.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { StartConsultationInput, ListConsultationsInput, CreatePrescriptionInput } from './consultation.validator.js';

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
  const consultation = await consultationService.end(consultationId, user.userId, user.role, notes);
  return sendSuccess(res, consultation, 'Consultation completed');
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
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
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
 * Create prescription
 * POST /api/v1/prescriptions
 */
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreatePrescriptionInput;
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

