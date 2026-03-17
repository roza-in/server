import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { autoHospitalScope } from '../../middlewares/hospital-scope.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createScheduleSchema,
  bulkCreateSchedulesSchema,
  updateScheduleSchema,
  deleteScheduleSchema,
  getDoctorSchedulesSchema,
  createOverrideSchema,
  deleteOverrideSchema,
  getOverridesSchema,
  getAvailableSlotsSchema,
} from './schedule.validator.js';
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
router.get('/doctor/:doctorId', validate(getDoctorSchedulesSchema), getDoctorSchedules);

/**
 * @route GET /api/v1/doctors/:doctorId/slots
 * @desc Get available slots for booking
 * @access Public
 */
router.get('/doctors/:doctorId/slots', validate(getAvailableSlotsSchema), getAvailableSlots);

// ============================================================================
// PROTECTED ROUTES - Auth required
// ============================================================================

router.use(authMiddleware);
// SC5: Auto-scope hospital staff to their own hospital
router.use(autoHospitalScope());

// ============================================================================
// HOSPITAL ADMIN ROUTES - Schedule Management
// SC5: Auto-scope to user's hospital to prevent cross-hospital schedule access
// ============================================================================

/**
 * @route POST /api/v1/doctors/:doctorId/schedules
 * @desc Create a schedule for a doctor
 * @access Hospital Admin, Platform Admin
 */
router.post(
  '/doctors/:doctorId/schedules',
  roleGuard('hospital', 'admin'),
  validate(createScheduleSchema),
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
  validate(bulkCreateSchedulesSchema),
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
  validate(updateScheduleSchema),
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
  validate(deleteScheduleSchema),
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
  roleGuard('hospital', 'admin', 'doctor'),
  validate(createOverrideSchema),
  createOverride
);

/**
 * @route GET /api/v1/doctors/:doctorId/overrides
 * @desc Get schedule overrides for doctor
 * @access Hospital Admin, Platform Admin
 */
router.get(
  '/doctors/:doctorId/overrides',
  roleGuard('hospital', 'admin', 'doctor'),
  validate(getOverridesSchema),
  getOverrides
);

/**
 * @route DELETE /api/v1/overrides/:overrideId
 * @desc Delete a schedule override
 * @access Hospital Admin, Platform Admin
 */
router.delete(
  '/overrides/:overrideId',
  roleGuard('hospital', 'admin', 'doctor'),
  validate(deleteOverrideSchema),
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
