import { Request, Response } from 'express';
import { appointmentService } from './appointment.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { BookAppointmentInput, ListAppointmentsInput, RescheduleAppointmentInput, CancelAppointmentInput, UpdateAppointmentStatusInput } from './appointment.validator.js';

/**
 * Appointment Controller - Handles HTTP requests for appointments
 */

/**
 * Get consultation fee breakdown
 * GET /api/v1/appointments/fee-breakdown
 */
export const getConsultationFee = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, consultationType, hospitalId } = req.query as any;
  const result = await appointmentService.getFeeBreakdown(doctorId, consultationType, hospitalId);
  return sendSuccess(res, result);
});

/**
 * Check doctor availability
 * GET /api/v1/appointments/check-availability
 */
export const checkAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, date, consultationType, hospitalId } = req.query as any;
  const slots = await appointmentService.getAvailableSlots(
    doctorId,
    hospitalId || null,
    date,
    consultationType
  );
  return sendSuccess(res, {
    doctorId,
    date,
    slots
  });
});

/**
 * Book a new appointment
 * POST /api/v1/appointments
 */
export const bookAppointment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as BookAppointmentInput;
  const result = await appointmentService.bookAppointment(user.userId, data);
  return sendCreated(res, result, 'Appointment booked successfully. Please complete payment.');
});

/**
 * Get appointment by ID
 * GET /api/v1/appointments/:appointmentId
 */
export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const appointment = await appointmentService.getById(appointmentId);
  return sendSuccess(res, appointment);
});

/**
 * List appointments
 * GET /api/v1/appointments
 */
export const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const query = req.query as unknown as ListAppointmentsInput;

  // Standardize filters
  const filters: any = { ...query };
  if (user.role === 'patient') filters.patient_id = user.userId;
  else if (user.role === 'doctor') filters.doctor_id = user.doctorId;
  else if (user.role === 'hospital') filters.hospital_id = user.hospitalId;

  const result = await appointmentService.list(filters);
  return sendPaginated(
    res,
    result.appointments,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages
    }
  );
});

/**
 * Get today's appointments (for dashboard)
 */
export const getTodayAppointments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const today = new Date().toISOString().split('T')[0];

  const filters: any = { date_from: today, date_to: today };
  if (user.role === 'patient') filters.patient_id = user.userId;
  else if (user.role === 'doctor') filters.doctor_id = user.doctorId;
  else if (user.role === 'hospital') filters.hospital_id = user.hospitalId;

  const result = await appointmentService.list(filters);
  return sendSuccess(res, result.appointments);
});

/**
 * Cancel appointment
 * PATCH /api/v1/appointments/:appointmentId/cancel
 */
export const cancelAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CancelAppointmentInput['body'];
  const result = await appointmentService.updateStatus(
    appointmentId,
    'cancelled',
    user.userId,
    user.role,
    data.reason
  );
  return sendSuccess(res, result, 'Appointment cancelled');
});

/**
 * Reschedule appointment
 * PATCH /api/v1/appointments/:appointmentId/reschedule
 */
export const rescheduleAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as RescheduleAppointmentInput['body'];
  const appointment = await appointmentService.reschedule(
    appointmentId,
    user.userId,
    user.role,
    {
      newDate: data.newDate,
      newStartTime: data.newStartTime,
      reason: data.reason
    }
  );
  return sendSuccess(res, appointment, 'Appointment rescheduled successfully');
});

/**
 * Update appointment status (generic)
 * PATCH /api/v1/appointments/:appointmentId/status
 */
export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { status, notes } = req.body as UpdateAppointmentStatusInput['body'];
  const appointment = await appointmentService.updateStatus(
    appointmentId,
    status as any,
    user.userId,
    user.role,
    notes
  );
  return sendSuccess(res, appointment, MESSAGES.UPDATED);
});

/**
 * Rate appointment
 * POST /api/v1/appointments/:appointmentId/rate
 */
export const rateAppointment = asyncHandler(async (req: Request, res: Response) => {
  // Logic for rating - usually update appointment with rating or create rating record
  // For now, placeholder success response
  return sendSuccess(res, null, 'Rating submitted');
});

/**
 * Mark appointment as no-show
 */
export const markNoShow = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const appointment = await appointmentService.updateStatus(
    appointmentId,
    'no_show',
    user.userId,
    user.role
  );
  return sendSuccess(res, appointment, 'Marked as no-show');
});



