import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getDoctorSchedules,
  bulkCreateSchedules,
  createOverride,
  getOverrides,
  deleteOverride,
  getAvailableSlots,
  regenerateSlots,
  generateAllSlots,
} from './schedule.controller.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTES - No auth required
// ============================================================================

/**
 * @route GET /api/v1/schedules/doctor/:doctorId
 * @desc Get doctor's weekly schedule
 * @access Public
 */
router.get('/doctor/:doctorId', getDoctorSchedules);

/**
 * @route GET /api/v1/doctors/:doctorId/slots
 * @desc Get available slots for booking
 * @access Public
 */
router.get('/doctors/:doctorId/slots', getAvailableSlots);

// ============================================================================
// PROTECTED ROUTES - Auth required
// ============================================================================

router.use(authMiddleware);

// ============================================================================
// HOSPITAL ADMIN ROUTES - Schedule Management
// ============================================================================

/**
 * @route POST /api/v1/doctors/:doctorId/schedules
 * @desc Create a schedule for a doctor
 * @access Hospital Admin, Platform Admin
 */
router.post(
  '/doctors/:doctorId/schedules',
  roleGuard('hospital', 'admin'),
  createSchedule
);

/**
 * @route PUT /api/v1/doctors/:doctorId/schedules
 * @desc Bulk create/replace schedules for a doctor
 * @access Hospital Admin, Platform Admin
 */
router.put(
  '/doctors/:doctorId/schedules',
  roleGuard('hospital', 'admin'),
  bulkCreateSchedules
);

/**
 * @route PATCH /api/v1/schedules/:scheduleId
 * @desc Update a schedule
 * @access Hospital Admin, Platform Admin
 */
router.patch(
  '/:scheduleId',
  roleGuard('hospital', 'admin'),
  updateSchedule
);

/**
 * @route DELETE /api/v1/schedules/:scheduleId
 * @desc Delete a schedule
 * @access Hospital Admin, Platform Admin
 */
router.delete(
  '/:scheduleId',
  roleGuard('hospital', 'admin'),
  deleteSchedule
);

// ============================================================================
// OVERRIDE MANAGEMENT
// ============================================================================

/**
 * @route POST /api/v1/doctors/:doctorId/overrides
 * @desc Create a schedule override (holiday, leave, special hours)
 * @access Hospital Admin, Platform Admin
 */
router.post(
  '/doctors/:doctorId/overrides',
  roleGuard('hospital', 'admin'),
  createOverride
);

/**
 * @route GET /api/v1/doctors/:doctorId/overrides
 * @desc Get schedule overrides for doctor
 * @access Hospital Admin, Platform Admin
 */
router.get(
  '/doctors/:doctorId/overrides',
  roleGuard('hospital', 'admin'),
  getOverrides
);

/**
 * @route DELETE /api/v1/overrides/:overrideId
 * @desc Delete a schedule override
 * @access Hospital Admin, Platform Admin
 */
router.delete(
  '/overrides/:overrideId',
  roleGuard('hospital', 'admin'),
  deleteOverride
);

// ============================================================================
// SLOT MANAGEMENT (Admin)
// ============================================================================

/**
 * @route POST /api/v1/doctors/:doctorId/slots/regenerate
 * @desc Regenerate slots for a doctor
 * @access Platform Admin
 */
router.post(
  '/doctors/:doctorId/slots/regenerate',
  roleGuard('admin'),
  regenerateSlots
);

/**
 * @route POST /api/v1/admin/slots/generate-all
 * @desc Generate slots for all doctors (cron job)
 * @access Platform Admin
 */
router.post(
  '/admin/slots/generate-all',
  roleGuard('admin'),
  generateAllSlots
);

export const scheduleRoutes = router;
export default router;
