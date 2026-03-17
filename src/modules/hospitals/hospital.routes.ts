import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { hospitalScope } from '../../middlewares/hospital-scope.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  getHospitalSchema,
  getHospitalBySlugSchema,
  listHospitalsSchema,
  updateHospitalSchema,
  updatePaymentSettingsSchema,
  hospitalStatsSchema,
  addDoctorToHospitalSchema,
  verifyHospitalSchema,
  listHospitalPatientsSchema,
  listHospitalAppointmentsSchema,
  listHospitalPaymentsSchema,
  addStaffSchema,
  removeStaffSchema,
} from './hospital.validator.js';
import {
  updateHospital,
  getHospital,
  getHospitalBySlug,
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
import {
  createAnnouncement,
  getActiveAnnouncements,
  getPublicAnnouncements,
  getAllAnnouncements,
  updateAnnouncement,
  deactivateAnnouncement,
} from './announcement.controller.js';

const router = Router();

// ============================================================================
// Public Routes
// ============================================================================

/**
 * @route GET /api/v1/hospitals
 * @desc List all hospitals (public)
 * @access Public
 */
router.get('/', validate(listHospitalsSchema), listHospitals);

/**
 * @route GET /api/v1/hospitals/slug/:slug
 * @desc Get hospital by slug (public)
 * @access Public
 */
router.get('/slug/:slug', validate(getHospitalBySlugSchema), getHospitalBySlug);

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

// SC5: Enforce hospital-level data isolation on all /:hospitalId routes.
// hospitalScope() verifies that doctor/hospital/reception users belong to the
// requested hospital, preventing cross-hospital data access.
router.use('/:hospitalId', hospitalScope());

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
  validate(hospitalStatsSchema),
  getHospitalStats
);

/**
 * @route GET /api/v1/hospitals/:hospitalId
 * @desc Get hospital by ID
 * @access Private
 */
router.get('/:hospitalId', validate(getHospitalSchema), getHospital);

/**
 * @route PUT /api/v1/hospitals/:hospitalId
 * @desc Update hospital details
 * @access Private (hospital admin or admin)
 */
router.put(
  '/:hospitalId',
  roleGuard('hospital', 'admin'),
  validate(updateHospitalSchema),
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
  validate(listHospitalPatientsSchema),
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
  validate(listHospitalAppointmentsSchema),
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
  validate(listHospitalPaymentsSchema),
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
  validate(addDoctorToHospitalSchema),
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
  validate(addStaffSchema),
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
  validate(removeStaffSchema),
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
  validate(verifyHospitalSchema),
  verifyHospital
);

// ============================================================================
// ANNOUNCEMENTS (I1 — hospital_announcements table)
// ============================================================================

/**
 * @route GET /api/v1/hospitals/:hospitalId/announcements/public
 * @desc Get public announcements (patient-facing)
 * @access Public
 */
router.get('/:hospitalId/announcements/public', getPublicAnnouncements);

/**
 * @route GET /api/v1/hospitals/:hospitalId/announcements/active
 * @desc Get active announcements (staff view)
 * @access Private (hospital, doctor, reception)
 */
router.get('/:hospitalId/announcements/active', authMiddleware, roleGuard('hospital', 'doctor', 'reception', 'admin'), getActiveAnnouncements);

/**
 * @route GET /api/v1/hospitals/:hospitalId/announcements
 * @desc Get all announcements with pagination
 * @access Private (hospital, admin)
 */
router.get('/:hospitalId/announcements', authMiddleware, roleGuard('hospital', 'admin'), getAllAnnouncements);

/**
 * @route POST /api/v1/hospitals/:hospitalId/announcements
 * @desc Create announcement
 * @access Private (hospital, admin)
 */
router.post('/:hospitalId/announcements', authMiddleware, roleGuard('hospital', 'admin'), createAnnouncement);

/**
 * @route PATCH /api/v1/hospitals/:hospitalId/announcements/:announcementId
 * @desc Update announcement
 * @access Private (hospital, admin)
 */
router.patch('/:hospitalId/announcements/:announcementId', authMiddleware, roleGuard('hospital', 'admin'), updateAnnouncement);

/**
 * @route DELETE /api/v1/hospitals/:hospitalId/announcements/:announcementId
 * @desc Deactivate announcement
 * @access Private (hospital, admin)
 */
router.delete('/:hospitalId/announcements/:announcementId', authMiddleware, roleGuard('hospital', 'admin'), deactivateAnnouncement);

export const hospitalRoutes = router;
export default router;

