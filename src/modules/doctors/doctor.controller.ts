// @ts-nocheck
import { Request, Response } from 'express';
import { doctorService } from './doctor.service.js';
import { getSupabaseAdmin } from '../../config/db.js';
import { BadRequestError } from '../../common/errors.js';
import { sendSuccess, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { ListDoctorsInput, UpdateDoctorInput, GetDoctorAvailabilityInput, CreateDoctorInput } from './doctor.validator.js';

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

  // If request is authenticated and user is a hospital admin, restrict to that hospital
  const authUser = (req as AuthenticatedRequest).user;
  if (authUser && authUser.role === 'hospital') {
    try {
      const supabase = getSupabaseAdmin();
      const adminId = (authUser as any).userId || (authUser as any).id || (authUser as any).sub || null;
      const { data: hosp } = await supabase
        .from('hospitals')
        .select('id')
        .eq('admin_user_id', adminId)
        .limit(1)
        .single();

      if (hosp && hosp.id) {
        // override any incoming hospital filter to ensure hospital only sees their doctors
        (filters as any).hospital_id = hosp.id;
        // let service know hospital view should include unverified doctors
        (filters as any).include_unverified = true;
      }
    } catch (e) {
      // ignore — we'll proceed without hospital filter
    }
  }

  const result = await doctorService.list(filters);
  const pagination = {
    page: Number(result.page) || 1,
    limit: Number(result.limit) || 20,
    total: Number(result.total) || 0,
    totalPages: Number(result.totalPages) || 0,
  };
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

/**
 * Get list of specializations
 * GET /api/v1/doctors/specializations
 */
export const getSpecializations = asyncHandler(async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('specializations')
      .select('id, name, display_name, icon_url')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new BadRequestError('Failed to fetch specializations');
    }

    return sendSuccess(res, data || []);
  } catch (error) {
    throw error;
  }
});

