// @ts-nocheck
import { Request, Response } from 'express';
import { hospitalService } from './hospital.service.js';
import { sendSuccess, sendCreated, sendPaginated, responses } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { UpdateHospitalInput, ListHospitalsInput, AddDoctorToHospitalInput } from './hospital.validator.js';

/**
 * Hospital Controller - Handles HTTP requests for hospitals
 */

/**
 * Get hospital by ID
 * GET /api/v1/hospitals/:hospitalId
 */
export const getHospital = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const hospital = await hospitalService.getById(hospitalId);
  return sendSuccess(res, hospital);
});

/**
 * Get hospital by slug (public)
 * GET /api/v1/hospitals/slug/:slug
 */
export const getHospitalBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const hospital = await hospitalService.getBySlug(slug);
  return sendSuccess(res, hospital);
});

/**
 * List hospitals
 * GET /api/v1/hospitals
 */
export const listHospitals = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListHospitalsInput;
  const result = await hospitalService.list(filters);
  return sendPaginated(
    res,
    result.hospitals,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  );
});

/**
 * Get current user's hospital
 * GET /api/v1/hospitals/me
 */
export const getMyHospital = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const hospital = await hospitalService.getByUserId(user.userId);
  return sendSuccess(res, hospital);
});

/**
 * Update hospital
 * PATCH /api/v1/hospitals/:hospitalId
 */
export const updateHospital = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateHospitalInput;
  const isAdmin = user?.role === 'admin';
  const hospital = await hospitalService.update(hospitalId, user.userId, data, isAdmin);
  return sendSuccess(res, hospital, MESSAGES.UPDATED);
});

/**
 * Add doctor to hospital
 * POST /api/v1/hospitals/:hospitalId/doctors
 */
export const addDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as AddDoctorToHospitalInput;
  const doctor = await hospitalService.addDoctor(hospitalId, user.userId, data);
  return sendCreated(res, doctor, MESSAGES.CREATED);
});

/**
 * Get hospital doctors
 * GET /api/v1/hospitals/:hospitalId/doctors
 */
export const getHospitalDoctors = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const doctors = await hospitalService.getDoctors(hospitalId);
  return sendSuccess(res, doctors);
});

/**
 * Get hospital statistics
 * GET /api/v1/hospitals/:hospitalId/stats
 */
export const getHospitalStats = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { period } = req.query;
  const stats = await hospitalService.getStats(hospitalId, user.userId, period as string);
  return sendSuccess(res, stats);
});

/**
 * Verify hospital (admin only)
 * POST /api/v1/hospitals/:hospitalId/verify
 */
export const verifyHospital = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const data = req.body;
  const hospital = await hospitalService.verify(hospitalId, data);
  return sendSuccess(res, hospital, MESSAGES.UPDATED);
});

