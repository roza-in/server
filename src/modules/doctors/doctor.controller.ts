import { Request, Response } from 'express';
import { doctorService } from './doctor.service.js';
import { specializationRepository } from '../../database/repositories/specialization.repo.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { ListDoctorsInput, UpdateDoctorInput, CreateDoctorInput } from './doctor.validator.js';
import { doctorPolicy } from './doctor.policy.js';
import { ForbiddenError, NotFoundError } from '../../common/errors/index.js';

/**
 * Doctor Controller - Handles HTTP requests for doctors
 */

/**
 * Add a new doctor
 * POST /api/v1/doctors
 */
export const addDoctor = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateDoctorInput;

  if (!doctorPolicy.canCreate(user)) {
    throw new ForbiddenError('You do not have permission to add doctors');
  }

  const doctor = await doctorService.add(data as any, user.userId);
  return sendSuccess(res, doctor, MESSAGES.CREATED);
});

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
  const authUser = (req as AuthenticatedRequest).user;

  // Filter scoped to hospital if requester is hospital admin
  if (authUser && authUser.role === 'hospital') {
    const hospital = await hospitalRepository.findByUserId(authUser.userId);
    if (hospital) {
      (filters as any).hospital_id = hospital.id;
      (filters as any).include_unverified = true;
    }
  }

  const result = await doctorService.list(filters);
  const pagination = calculatePagination(result.total, result.page, result.limit);
  return sendPaginated(res, result.doctors, pagination);
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

  const doctor = await doctorService.getById(doctorId);
  if (!doctorPolicy.canUpdate(user, doctor)) {
    throw new ForbiddenError('You do not have permission to update this profile');
  }

  const updated = await doctorService.update(doctorId, user.userId, user.role, data);
  return sendSuccess(res, updated, MESSAGES.UPDATED);
});

/**
 * Update doctor status
 * PATCH /api/v1/doctors/:doctorId/status
 */
export const updateDoctorStatus = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { status } = req.body;

  const doctor = await doctorService.getById(doctorId);
  if (!doctorPolicy.canDelete(user, doctor)) {
    throw new ForbiddenError('You do not have permission to change this doctor status');
  }

  const updated = await doctorService.updateStatus(doctorId, user.userId, user.role, status);
  return sendSuccess(res, updated, MESSAGES.UPDATED);
});

/**
 * Get doctor availability
 * GET /api/v1/doctors/:doctorId/availability
 */
export const getDoctorAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { days } = req.query;

  const availability = await doctorService.getAvailability(
    doctorId,
    days ? Number(days) : 7
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

/**
 * Get doctor weekly schedule
 * GET /api/v1/doctors/:doctorId/schedule
 */
export const getDoctorSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const schedule = await doctorService.getSchedules(doctorId);
  return sendSuccess(res, schedule);
});

/**
 * Get list of specializations
 * GET /api/v1/doctors/specializations
 */
export const getSpecializations = asyncHandler(async (req: Request, res: Response) => {
  const data = await specializationRepository.listAll();
  return sendSuccess(res, data);
});


