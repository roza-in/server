import { Request, Response } from 'express';
import { hospitalService } from './hospital.service.js';
import { doctorService } from '../doctors/doctor.service.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { UpdateHospitalInput, ListHospitalsInput, AddDoctorToHospitalInput } from './hospital.validator.js';
import { hospitalPolicy } from './hospital.policy.js';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '../../common/errors/index.js';

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
    calculatePagination(result.total, result.page, result.limit)
  );
});

/**
 * Get current user's hospital
 * GET /api/v1/hospitals/me
 */
export const getMyHospital = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const hospital = await hospitalService.getByUserId(user.userId);
  if (!hospital) {
    throw new NotFoundError('No hospital found for this user');
  }
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

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canUpdate(user, hospital)) {
    throw new ForbiddenError('You do not have permission to update this hospital');
  }

  const isAdmin = user?.role === 'admin';
  const updated = await hospitalService.update(hospitalId, user.userId, data, isAdmin);
  return sendSuccess(res, updated, MESSAGES.UPDATED);
});

/**
 * Get hospital patients
 * GET /api/v1/hospitals/:hospitalId/patients
 */
export const getHospitalPatients = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query;

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canView(user, hospital)) {
    throw new ForbiddenError('Access denied');
  }

  const result = await hospitalService.getPatients(hospitalId, filters);
  return sendPaginated(res, result.patients, calculatePagination(result.total, result.page, result.limit));
});

/**
 * Get hospital appointments
 * GET /api/v1/hospitals/:hospitalId/appointments
 */
export const getHospitalAppointments = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query;

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canView(user, hospital)) {
    throw new ForbiddenError('Access denied');
  }

  const result = await hospitalService.getAppointments(hospitalId, filters);
  return sendPaginated(res, result.appointments, calculatePagination(result.total, result.page, result.limit));
});

/**
 * Get hospital payments
 * GET /api/v1/hospitals/:hospitalId/payments
 */
export const getHospitalPayments = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query;

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canView(user, hospital)) {
    throw new ForbiddenError('Access denied');
  }

  const result = await hospitalService.getPayments(hospitalId, filters);
  return sendPaginated(res, result.payments, calculatePagination(result.total, result.page, result.limit));
});

/**
 * Get hospital invoices
 * GET /api/v1/hospitals/:hospitalId/invoices
 */
export const getHospitalInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query;

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canView(user, hospital)) {
    throw new ForbiddenError('Access denied');
  }

  const result = await hospitalService.getInvoices(hospitalId, filters);
  return sendPaginated(res, result.invoices, calculatePagination(result.total, result.page, result.limit));
});

/**
 * Add doctor to hospital
 * POST /api/v1/hospitals/:hospitalId/doctors
 */
export const addDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as AddDoctorToHospitalInput;

  const hospital = await hospitalService.getById(hospitalId);
  if (!hospitalPolicy.canUpdate(user, hospital as any)) {
    throw new ForbiddenError('You do not have permission to add doctors to this hospital');
  }

  const doctor = await doctorService.add(data as any, user.userId);
  return sendSuccess(res, doctor, MESSAGES.CREATED);
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
  const user = (req as AuthenticatedRequest).user;

  if (!hospitalPolicy.isAdmin(user)) {
    throw new ForbiddenError('Only system administrators can verify hospitals');
  }

  const data = req.body;
  const hospital = await hospitalService.verify(hospitalId, data);
  return sendSuccess(res, hospital, MESSAGES.UPDATED);
});

/**
 * Get hospital dashboard
 * GET /api/v1/hospitals/:hospitalId/dashboard
 */
export const getHospitalDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  const dashboard = await hospitalService.getDashboard(hospitalId, user.userId);
  return sendSuccess(res, dashboard);
});

/**
 * Update doctor settings (consultation types, fees, slot config)
 * PATCH /api/v1/hospital/doctors/:doctorId/settings
 */
export const updateDoctorSettings = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body;

  // Verify doctor exists and belongs to user's hospital
  const doctor = await doctorRepository.findWithRelations(doctorId);
  if (!doctor) {
    throw new NotFoundError('Doctor not found');
  }

  // Check if user is hospital admin for this doctor
  const hospitalAdminId = (doctor as any).hospitals?.admin_user_id;
  if (user.role !== 'admin' && hospitalAdminId !== user.userId) {
    throw new ForbiddenError('You can only update settings for doctors in your hospital');
  }

  // Update doctor settings
  const updated = await hospitalService.updateDoctorSettings(doctorId, data);
  return sendSuccess(res, updated, MESSAGES.UPDATED);
});

// ============================================================================
// Staff Management (Reception Users)
// ============================================================================

/**
 * Add staff to hospital
 * POST /api/v1/hospitals/:hospitalId/staff
 */
export const addHospitalStaff = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body;

  const result = await hospitalService.addStaff(hospitalId, user.userId, data);
  return sendCreated(res, result, 'Staff member added successfully');
});

/**
 * List hospital staff
 * GET /api/v1/hospitals/:hospitalId/staff
 */
export const listHospitalStaff = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  const staff = await hospitalService.listStaff(hospitalId, user.userId);
  return sendSuccess(res, staff);
});

/**
 * Remove staff from hospital
 * DELETE /api/v1/hospitals/:hospitalId/staff/:staffId
 */
export const removeHospitalStaff = asyncHandler(async (req: Request, res: Response) => {
  const { hospitalId, staffId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  await hospitalService.removeStaff(hospitalId, staffId, user.userId);
  return sendSuccess(res, null, 'Staff member removed successfully');
});


