import { Router } from 'express';
import {
  // Dashboard
  getDashboard,
  getRevenue,
  getUserGrowth,
  // Hospitals
  listHospitals,
  verifyHospital,
  deleteHospital,
  updateHospitalStatus,
  // Doctors
  listDoctors,
  verifyDoctor,
  updateDoctorStatus,
  // Users
  listUsers,
  listPatients,
  getUser,
  updateUserStatus,
  deleteUser,
  // Audit Logs
  listAuditLogs,
  getAuditLog,
  // Settings
  getSettings,
  getSetting,
  updateSetting,
  resetSetting,
  // Reports
  generateReport,
  getScheduledReports,
  // Analytics
  getAnalyticsOverview,
  getAppointmentTrends,
  getRevenueTrends,
  getUserTrends,
} from './admin.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  listUsersQuerySchema,
  getUserParamsSchema,
  updateUserStatusSchema,
  deleteUserParamsSchema,
  userGrowthQuerySchema,
  trendPeriodSchema,
  listHospitalsQuerySchema,
  hospitalParamsSchema,
  verifyHospitalSchema,
  updateHospitalStatusSchema,
  listDoctorsQuerySchema,
  doctorParamsSchema,
  verifyDoctorSchema,
  updateDoctorStatusSchema,
  auditLogParamsSchema,
  settingKeySchema,
  settingUpdateSchema,
  reportTypeSchema,
} from './admin.validator.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware, roleGuard('admin'));

// ============================================================================
// DASHBOARD & STATS
// ============================================================================
router.get('/', getDashboard);
router.get('/stats', getDashboard);
router.get('/revenue', getRevenue);
router.get('/users/growth', validate(userGrowthQuerySchema), getUserGrowth);

// ============================================================================
// HOSPITALS
// ============================================================================
router.get('/hospitals', validate(listHospitalsQuerySchema), listHospitals);
router.patch('/hospitals/:id/verify', validate(verifyHospitalSchema), verifyHospital);
router.patch('/hospitals/:id/status', validate(updateHospitalStatusSchema), updateHospitalStatus);
router.delete('/hospitals/:id', validate(hospitalParamsSchema), deleteHospital);

// ============================================================================
// DOCTORS
// ============================================================================
router.get('/doctors', validate(listDoctorsQuerySchema), listDoctors);
router.patch('/doctors/:id/verify', validate(verifyDoctorSchema), verifyDoctor);
router.patch('/doctors/:id/status', validate(updateDoctorStatusSchema), updateDoctorStatus);

// ============================================================================
// USERS
// ============================================================================
router.get('/users', validate(listUsersQuerySchema), listUsers);
router.get('/patients', listPatients);
router.get('/users/:id', validate(getUserParamsSchema), getUser);
router.patch('/users/:id/status', validate(updateUserStatusSchema), updateUserStatus);
router.delete('/users/:id', validate(deleteUserParamsSchema), deleteUser);

// ============================================================================
// ANALYTICS & TRENDS
// ============================================================================
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/trends/appointments', validate(trendPeriodSchema), getAppointmentTrends);
router.get('/analytics/trends/revenue', validate(trendPeriodSchema), getRevenueTrends);
router.get('/analytics/trends/users', validate(trendPeriodSchema), getUserTrends);

// ============================================================================
// AUDIT LOGS
// ============================================================================
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/:id', validate(auditLogParamsSchema), getAuditLog);

// ============================================================================
// SETTINGS (platform_config)
// ============================================================================
router.get('/settings', getSettings);
router.get('/settings/:key', validate(settingKeySchema), getSetting);
router.put('/settings/:key', validate(settingUpdateSchema), updateSetting);
router.post('/settings/:key/reset', validate(settingKeySchema), resetSetting);

// ============================================================================
// REPORTS — scheduled BEFORE :type to avoid wildcard capture
// ============================================================================
router.get('/reports/scheduled', getScheduledReports);
router.post('/reports/:type', validate(reportTypeSchema), generateReport);

export const adminRoutes = router;
export default router;
