import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
  updateHospital,
  getHospital,
  listHospitals,
  getHospitalStats,
  addDoctor,
  verifyHospital,
  getMyHospital,
  getHospitalPatients,
  getHospitalAppointments,
  getHospitalPayments,
  getHospitalInvoices,
  getHospitalDoctors,
  updateDoctorSettings,
  addHospitalStaff,
  listHospitalStaff,
  removeHospitalStaff,
  getHospitalDashboard,
} from './hospital.controller.js';

const router = Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * @route GET /api/v1/hospitals
 * @desc List all hospitals (public)
 * @access Public
 */
router.get('/', listHospitals);

// ============================================================================
// Private Routes (Hospital Admin & Platform Admin)
// ============================================================================

router.use(authMiddleware);

/**
 * @route GET /api/v1/hospitals/me
 * @desc Get current user's hospital
 * @access Private (hospital admin)
 */
router.get(
  '/me',
  roleGuard('hospital'),
  getMyHospital
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/dashboard
 * @desc Get hospital dashboard data
 * @access Private (hospital admin)
 */
router.get(
  '/:hospitalId/dashboard',
  roleGuard('hospital', 'admin'),
  getHospitalDashboard
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/stats
 * @desc Get hospital statistics
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/stats',
  roleGuard('hospital', 'admin'),
  getHospitalStats
);

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
  roleGuard('hospital', 'admin'),
  updateHospital
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/patients
 * @desc Get hospital patients
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/patients',
  roleGuard('hospital', 'admin'),
  getHospitalPatients
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/appointments
 * @desc Get hospital appointments
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/appointments',
  roleGuard('hospital', 'admin'),
  getHospitalAppointments
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/payments
 * @desc Get hospital payments
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/payments',
  roleGuard('hospital', 'admin'),
  getHospitalPayments
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/invoices
 * @desc Get hospital invoices
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/invoices',
  roleGuard('hospital', 'admin'),
  getHospitalInvoices
);

/**
 * @route POST /api/v1/hospitals/:hospitalId/doctors
 * @desc Add a doctor to hospital
 * @access Private (hospital admin)
 */
router.post(
  '/:hospitalId/doctors',
  roleGuard('hospital', 'admin'),
  addDoctor
);

/**
 * @route PATCH /api/v1/hospitals/:hospitalId/doctors/:doctorId/settings
 * @desc Update doctor settings
 * @access Private (hospital admin or admin)
 */
router.patch(
  '/:hospitalId/doctors/:doctorId/settings',
  roleGuard('hospital', 'admin'),
  updateDoctorSettings
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/doctors
 * @desc Get hospital doctors
 * @access Private (hospital admin or admin)
 */
router.get(
  '/:hospitalId/doctors',
  roleGuard('hospital', 'admin'),
  getHospitalDoctors
);

// ============================================================================
// Staff Management Routes
// ============================================================================

/**
 * @route POST /api/v1/hospitals/:hospitalId/staff
 * @desc Add reception staff to hospital
 * @access Private (hospital admin)
 */
router.post(
  '/:hospitalId/staff',
  roleGuard('hospital', 'admin'),
  addHospitalStaff
);

/**
 * @route GET /api/v1/hospitals/:hospitalId/staff
 * @desc List hospital staff
 * @access Private (hospital admin)
 */
router.get(
  '/:hospitalId/staff',
  roleGuard('hospital', 'admin'),
  listHospitalStaff
);

/**
 * @route DELETE /api/v1/hospitals/:hospitalId/staff/:staffId
 * @desc Remove staff from hospital
 * @access Private (hospital admin)
 */
router.delete(
  '/:hospitalId/staff/:staffId',
  roleGuard('hospital', 'admin'),
  removeHospitalStaff
);

/**
 * @route PATCH /api/v1/hospitals/:hospitalId/verify
 * @desc Verify a hospital (admin only)
 * @access Private (admin)
 */
router.patch(
  '/:hospitalId/verify',
  roleGuard('admin'),
  verifyHospital
);

export const hospitalRoutes = router;
export default router;

