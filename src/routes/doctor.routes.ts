import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  getDoctor,
  listDoctors,
  getDoctorStats,
  getDoctorAvailability,
} from '../modules/doctors/doctor.controller.js';

const router = Router();

/**
 * @route GET /api/v1/doctors
 * @desc List all doctors (public)
 * @access Public
 */
router.get('/', listDoctors);

/**
 * @route GET /api/v1/doctors/:doctorId
 * @desc Get doctor by ID (public)
 * @access Public
 */
router.get('/:doctorId', getDoctor);

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
