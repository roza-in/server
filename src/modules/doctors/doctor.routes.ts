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
 * @router Posts /api/v1/doctors
 * @desc Doctor routes
 * @access Public
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
 */
router.get('/specializations', getSpecializations);

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
router.get('/:doctorId/profile', getDoctorProfile);

/**
 * @route PATCH /api/v1/doctors/:doctorId
 * @desc Update doctor (doctor or hospital)
 * @access Private
 */
router.patch('/:doctorId', authMiddleware, validate(updateDoctorSchema), updateDoctor);

/**
 * @route PATCH /api/v1/doctors/:doctorId/status
 * @desc Update doctor status (hospital/admin)
 * @access Private (hospital)
 */
router.patch('/:doctorId/status', authMiddleware, roleGuard('hospital'), validate(updateDoctorStatusSchema), updateDoctorStatus);

/**
 * @route GET /api/v1/doctors/me/stats
 * @desc Get doctor statistics
 * @access Private (doctor)
 */
// "me" isn't a uuid, so we might need a separate route or careful ordering if we used :doctorId for "me"
// But here the route is explicit /me/stats, so no param validation needed for ID
router.get('/me/stats', authMiddleware, roleGuard('doctor'), getDoctorStats); // Params are usually from token, but might support query filters

/**
 * @route GET /api/v1/doctors/:doctorId/availability
 * @desc Get doctor availability for a date
 * @access Public
 */
router.get('/:doctorId/availability', getDoctorAvailability);

/**
 * @route GET /api/v1/doctors/:doctorId/schedule
 * @desc Get doctor weekly schedule
 * @access Public
 */
router.get('/:doctorId/schedule', getDoctorSchedule);

export const doctorRoutes = router;
export default router;

