import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  updateHospital,
  getHospital,
  listHospitals,
  getHospitalStats,
  addDoctor,
  verifyHospital,
} from '../modules/hospitals/hospital.controller.js';

const router = Router();

/**
 * @route GET /api/v1/hospitals
 * @desc List all hospitals (public)
 * @access Public
 */
router.get('/', listHospitals);

/**
 * @route GET /api/v1/hospitals/:hospitalId
 * @desc Get hospital by ID (public)
 * @access Public
 */
router.get('/:hospitalId', getHospital);

/**
 * @route PUT /api/v1/hospitals/:hospitalId
 * @desc Update hospital details
 * @access Private (hospital admin or admin)
 */
router.put(
  '/:hospitalId',
  authenticate,
  requireRole('hospital', 'admin'),
  updateHospital
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/stats
 * @desc Get hospital statistics
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/stats',
  authenticate,
  requireRole('hospital', 'admin'),
  getHospitalStats
);

/**
 * @route POST /api/v1/hospitals/:hospitalId/doctors
 * @desc Add a doctor to hospital
 * @access Private (hospital admin)
 */
router.post(
  '/:hospitalId/doctors',
  authenticate,
  requireRole('hospital', 'admin'),
  addDoctor
);

/**
 * @route PATCH /api/v1/hospitals/:hospitalId/verify
 * @desc Verify a hospital (admin only)
 * @access Private (admin)
 */
router.patch(
  '/:hospitalId/verify',
  authenticate,
  requireRole('admin'),
  verifyHospital
);

export const hospitalRoutes = router;
