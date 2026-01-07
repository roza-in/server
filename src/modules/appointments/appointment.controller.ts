// @ts-nocheck
import { Request, Response } from 'express';
import { appointmentService } from './appointment.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  BookAppointmentInput,
  ListAppointmentsInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
  UpdateAppointmentStatusInput,
  RateAppointmentInput,
} from './appointment.validator.js';

/**
 * Appointment Controller - Handles HTTP requests for appointments
 */

/**
 * Book a new appointment
 * POST /api/v1/appointments
 */
export const bookAppointment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as BookAppointmentInput;
  const result = await appointmentService.book(user.userId, data);
  return sendCreated(res, result, 'Appointment booked successfully. Please complete payment.');
});

/**
 * Get appointment by ID
 * GET /api/v1/appointments/:appointmentId
 */
export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const appointment = await appointmentService.getById(appointmentId, user.userId, user.role);
  return sendSuccess(res, appointment);
});

/**
 * List appointments
 * GET /api/v1/appointments
 */
export const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query as unknown as ListAppointmentsInput;
  const result = await appointmentService.list(filters, user.userId, user.role);
  return sendPaginated(
    res,
    result.appointments,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  );
});

/**
 * Get today's appointments (for dashboard)
 * GET /api/v1/appointments/today
 */
export const getTodayAppointments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const appointments = await appointmentService.getTodayAppointments(user.userId, user.role);
  return sendSuccess(res, appointments);
});

/**
 * Check in patient
 * POST /api/v1/appointments/:appointmentId/check-in
 */
export const checkInAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const appointment = await appointmentService.checkIn(appointmentId, user.userId, user.role);
  return sendSuccess(res, appointment, 'Patient checked in successfully');
});

/**
 * Start consultation
 * POST /api/v1/appointments/:appointmentId/start
 */
export const startConsultation = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const appointment = await appointmentService.startConsultation(appointmentId, user.userId, user.role);
  return sendSuccess(res, appointment, 'Consultation started');
});

/**
 * Complete consultation
 * POST /api/v1/appointments/:appointmentId/complete
 */
export const completeConsultation = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { notes } = req.body;
  const appointment = await appointmentService.completeConsultation(appointmentId, user.userId, user.role, notes);
  return sendSuccess(res, appointment, 'Consultation completed');
});

/**
 * Cancel appointment
 * POST /api/v1/appointments/:appointmentId/cancel
 */
export const cancelAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { reason } = req.body as CancelAppointmentInput['body'];
  const appointment = await appointmentService.cancel(appointmentId, user.userId, user.role, reason);
  return sendSuccess(res, appointment, 'Appointment cancelled');
});

/**
 * Mark as no-show
 * POST /api/v1/appointments/:appointmentId/no-show
 */
export const markNoShow = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const appointment = await appointmentService.markNoShow(appointmentId, user.userId, user.role);
  return sendSuccess(res, appointment, 'Appointment marked as no-show');
});

/**
 * Reschedule appointment
 * POST /api/v1/appointments/:appointmentId/reschedule
 */
export const rescheduleAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { newDate, newStartTime, reason } = req.body as RescheduleAppointmentInput['body'];
  const appointment = await appointmentService.reschedule(
    appointmentId,
    user.userId,
    user.role,
    newDate,
    newStartTime,
    reason
  );
  return sendSuccess(res, appointment, 'Appointment rescheduled successfully');
});

/**
 * Rate appointment
 * POST /api/v1/appointments/:appointmentId/rate
 */
export const rateAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { rating, review } = req.body as RateAppointmentInput['body'];
  const appointment = await appointmentService.rate(appointmentId, user.userId, rating, review);
  return sendSuccess(res, appointment, 'Thank you for your feedback');
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
    status,
    user.userId,
    user.role,
    notes
  );
  return sendSuccess(res, appointment, MESSAGES.UPDATED);
});

