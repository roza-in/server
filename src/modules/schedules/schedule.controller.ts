// @ts-nocheck
import { Request, Response } from 'express';
import { scheduleService } from './schedule.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { CreateScheduleInput, BulkCreateSchedulesInput, UpdateScheduleInput, CreateOverrideInput } from './schedule.validator.js';

/**
 * Schedule Controller - Handles HTTP requests for schedules
 */

/**
 * Get doctor's weekly schedule
 * GET /api/v1/doctors/:doctorId/schedules
 */
export const getDoctorSchedules = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const schedules = await scheduleService.getDoctorSchedules(doctorId);
  return sendSuccess(res, schedules);
});

/**
 * Create a schedule
 * POST /api/v1/doctors/:doctorId/schedules
 */
export const createSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateScheduleInput;
  const schedule = await scheduleService.createSchedule(doctorId, user.userId, user.role, data);
  return sendCreated(res, schedule, MESSAGES.CREATED);
});

/**
 * Bulk create schedules (replaces existing)
 * PUT /api/v1/doctors/:doctorId/schedules
 */
export const bulkCreateSchedules = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as BulkCreateSchedulesInput;
  const schedules = await scheduleService.bulkCreateSchedules(doctorId, user.userId, user.role, data);
  return sendSuccess(res, schedules, 'Schedules updated successfully');
});

/**
 * Update a schedule
 * PATCH /api/v1/schedules/:scheduleId
 */
export const updateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateScheduleInput;
  const schedule = await scheduleService.updateSchedule(scheduleId, user.userId, user.role, data);
  return sendSuccess(res, schedule, MESSAGES.UPDATED);
});

/**
 * Delete a schedule
 * DELETE /api/v1/schedules/:scheduleId
 */
export const deleteSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { scheduleId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await scheduleService.deleteSchedule(scheduleId, user.userId, user.role);
  return sendNoContent(res);
});

/**
 * Create schedule override
 * POST /api/v1/doctors/:doctorId/schedule-overrides
 */
export const createOverride = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateOverrideInput;
  const override = await scheduleService.createOverride(doctorId, user.userId, user.role, data);
  return sendCreated(res, override, MESSAGES.CREATED);
});

/**
 * Get schedule overrides
 * GET /api/v1/doctors/:doctorId/schedule-overrides
 */
export const getOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;
  const overrides = await scheduleService.getOverrides(
    doctorId,
    startDate as string,
    endDate as string
  );
  return sendSuccess(res, overrides);
});

/**
 * Delete schedule override
 * DELETE /api/v1/schedule-overrides/:overrideId
 */
export const deleteOverride = asyncHandler(async (req: Request, res: Response) => {
  const { overrideId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await scheduleService.deleteOverride(overrideId, user.userId, user.role);
  return sendNoContent(res);
});

