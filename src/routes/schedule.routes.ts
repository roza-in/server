import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getDoctorSchedules,
  createOverride,
  getOverrides,
  deleteOverride,
} from '../modules/schedules/schedule.controller.js';

const router = Router();

/**
 * @route POST /api/v1/schedules
 * @desc Create a new schedule
 * @access Private (doctor)
 */
router.post(
  '/',
  authenticate,
  requireRole('doctor'),
  createSchedule
);

/**
 * @route PUT /api/v1/schedules/:scheduleId
 * @desc Update a schedule
 * @access Private (doctor)
 */
router.put(
  '/:scheduleId',
  authenticate,
  requireRole('doctor'),
  updateSchedule
);

/**
 * @route DELETE /api/v1/schedules/:scheduleId
 * @desc Delete a schedule
 * @access Private (doctor)
 */
router.delete(
  '/:scheduleId',
  authenticate,
  requireRole('doctor'),
  deleteSchedule
);

/**
 * @route GET /api/v1/schedules/doctor/:doctorId
 * @desc Get all schedules for a doctor
 * @access Public
 */
router.get('/doctor/:doctorId', getDoctorSchedules);

/**
 * @route POST /api/v1/schedules/overrides
 * @desc Create a schedule override
 * @access Private (doctor)
 */
router.post(
  '/overrides',
  authenticate,
  requireRole('doctor'),
  createOverride
);

/**
 * @route GET /api/v1/schedules/overrides/:doctorId
 * @desc Get schedule overrides for doctor
 * @access Private
 */
router.get('/overrides/:doctorId', authenticate, getOverrides);

/**
 * @route DELETE /api/v1/schedules/overrides/:overrideId
 * @desc Delete a schedule override
 * @access Private (doctor)
 */
router.delete(
  '/overrides/:overrideId',
  authenticate,
  requireRole('doctor'),
  deleteOverride
);

export const scheduleRoutes = router;
