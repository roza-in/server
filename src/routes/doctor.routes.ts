import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createDoctorSchema } from '../modules/doctors/doctor.validator.js';
import {
  addDoctor,
  getDoctor,
  updateDoctor,
  updateDoctorStatus,
  listDoctors,
  getDoctorStats,
  getDoctorAvailability,
  getSpecializations,
} from '../modules/doctors/doctor.controller.js';

const router = Router();

/**
 * @router Posts /api/v1/doctors
 * @desc Doctor routes
 * @access Public
 */
router.post('/', authenticate, requireRole('hospital'), validate(createDoctorSchema), addDoctor);

/**
 * @route GET /api/v1/doctors
 * @desc List all doctors (public)
 * @access Public
 */
router.get('/', listDoctors);

/**
 * Public: list specializations
 */
router.get('/specializations', getSpecializations);

/**
 * @route GET /api/v1/doctors/:doctorId
 * @desc Get doctor by ID (public)
 * @access Public
 */
router.get('/:doctorId', getDoctor);

/**
 * @route PATCH /api/v1/doctors/:doctorId
 * @desc Update doctor (doctor or hospital)
 * @access Private
 */
router.patch('/:doctorId', authenticate, updateDoctor);

/**
 * @route PATCH /api/v1/doctors/:doctorId/status
 * @desc Update doctor status (hospital/admin)
 * @access Private (hospital)
 */
router.patch('/:doctorId/status', authenticate, requireRole('hospital'), updateDoctorStatus);

/**
 * @route GET /api/v1/doctors/me/stats
 * @desc Get doctor statistics
 * @access Private (doctor)
 */
router.get('/me/stats', authenticate, requireRole('doctor'), getDoctorStats);

/**
 * @route GET /api/v1/doctors/:doctorId/availability
 * @desc Get doctor availability for a date
 * @access Public
 */
router.get('/:doctorId/availability', getDoctorAvailability);

export const doctorRoutes = router;
