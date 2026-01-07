// @ts-nocheck
import { Request, Response } from 'express';
import { doctorService } from './doctor.service.js';
import { sendSuccess, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { ListDoctorsInput, UpdateDoctorInput, GetDoctorAvailabilityInput } from './doctor.validator.js';

/**
 * Doctor Controller - Handles HTTP requests for doctors
 */

/**
 * Get doctor by ID
 * GET /api/v1/doctors/:doctorId
 */
export const getDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const doctor = await doctorService.getById(doctorId);
  return sendSuccess(res, doctor);
});

/**
 * Get doctor public profile
 * GET /api/v1/doctors/:doctorId/profile
 */
export const getDoctorProfile = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const profile = await doctorService.getPublicProfile(doctorId);
  return sendSuccess(res, profile);
});

/**
 * List doctors
 * GET /api/v1/doctors
 */
export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ListDoctorsInput;
  const result = await doctorService.list(filters);
  return sendPaginated(
    res,
    result.doctors,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  );
});

/**
 * Get current user's doctor profile
 * GET /api/v1/doctors/me
 */
export const getMyDoctorProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const doctor = await doctorService.getByUserId(user.userId);
  return sendSuccess(res, doctor);
});

/**
 * Update doctor profile
 * PATCH /api/v1/doctors/:doctorId
 */
export const updateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateDoctorInput;
  const doctor = await doctorService.update(doctorId, user.userId, user.role, data);
  return sendSuccess(res, doctor, MESSAGES.UPDATED);
});

/**
 * Update doctor status
 * PATCH /api/v1/doctors/:doctorId/status
 */
export const updateDoctorStatus = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { status } = req.body;
  const doctor = await doctorService.updateStatus(doctorId, user.userId, user.role, status);
  return sendSuccess(res, doctor, MESSAGES.UPDATED);
});

/**
 * Get doctor availability
 * GET /api/v1/doctors/:doctorId/availability
 */
export const getDoctorAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { date, startDate, endDate, consultationType } = req.query;

  // Calculate days if date range provided
  let days = 7;
  if (startDate && endDate) {
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const availability = await doctorService.getAvailability(
    doctorId,
    (date as string) || (startDate as string),
    days,
    consultationType as 'online' | 'in_person' | undefined
  );

  return sendSuccess(res, availability);
});

/**
 * Get doctor statistics
 * GET /api/v1/doctors/:doctorId/stats
 */
export const getDoctorStats = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { period } = req.query;
  const stats = await doctorService.getStats(doctorId, user.userId, user.role, period as string);
  return sendSuccess(res, stats);
});

