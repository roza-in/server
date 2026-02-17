import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  getDoctorSchema,
  listDoctorsSchema,
  doctorStatsSchema,
  getDoctorAvailabilitySchema,
} from './doctor.validator.js';
import {
  addDoctor,
  getDoctor,
  getDoctorProfile,
  updateDoctor,
  updateDoctorStatus,
  listDoctors,
  getDoctorStats,
  getDoctorAvailability,
  getDoctorSchedule,
  getSpecializations,
} from './doctor.controller.js';

const router = Router();

/**
 * @route POST /api/v1/doctors
 * @desc Add a new doctor (hospital only)
 * @access Private (hospital)
 */
router.post('/', authMiddleware, roleGuard('hospital'), validate(createDoctorSchema), addDoctor);

/**
 * @route GET /api/v1/doctors
 * @desc List all doctors (public)
 * @access Public
 */
router.get('/', validate(listDoctorsSchema), listDoctors);

/**
 * @route GET /api/v1/doctors/specializations
 * @desc List specializations
 * @access Public
 */
router.get('/specializations', getSpecializations);

/**
 * @route GET /api/v1/doctors/me/stats
 * @desc Get current doctor's statistics
 * @access Private (doctor)
 */
router.get('/me/stats', authMiddleware, roleGuard('doctor'), validate(doctorStatsSchema), getDoctorStats);

/**
 * @route GET /api/v1/doctors/:doctorId
 * @desc Get doctor by ID (public)
 * @access Public
 */
router.get('/:doctorId', validate(getDoctorSchema), getDoctor);

/**
 * @route GET /api/v1/doctors/:doctorId/profile
 * @desc Get doctor public profile
 * @access Public
 */
router.get('/:doctorId/profile', validate(getDoctorSchema), getDoctorProfile);

/**
 * @route PATCH /api/v1/doctors/:doctorId
 * @desc Update doctor (doctor or hospital)
 * @access Private
 */
router.patch('/:doctorId', authMiddleware, validate(updateDoctorSchema), updateDoctor);

/**
 * @route PATCH /api/v1/doctors/:doctorId/status
 * @desc Update doctor status (hospital/admin)
 * @access Private (hospital, admin)
 */
router.patch('/:doctorId/status', authMiddleware, roleGuard('hospital', 'admin'), validate(updateDoctorStatusSchema), updateDoctorStatus);

/**
 * @route GET /api/v1/doctors/:doctorId/availability
 * @desc Get doctor availability
 * @access Public
 */
router.get('/:doctorId/availability', validate(getDoctorAvailabilitySchema), getDoctorAvailability);

/**
 * @route GET /api/v1/doctors/:doctorId/schedule
 * @desc Get doctor weekly schedule
 * @access Public
 */
router.get('/:doctorId/schedule', validate(getDoctorSchema), getDoctorSchedule);

export const doctorRoutes = router;
export default router;

