import { Router } from 'express';
import {
  // Dashboard
  getDashboard,
  getRevenue,
  getUserGrowth,
  // Listing & Management
  listHospitals,
  listDoctors,
  listUsers,
  listPatients,
  // Verification
  verifyHospital,
  deleteHospital,
  updateHospitalStatus,
  requestDocuments,
  verifyDoctor,
  updateDoctorStatus,
  // Users
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

const router = Router();

/**
 * Admin Routes - Aligned with frontend endpoints and RESTful patterns
 */

// ============================================================================
// DASHBOARD & STATS
// ============================================================================
router.get('/', authMiddleware, roleGuard('admin'), getDashboard);
router.get('/stats', authMiddleware, roleGuard('admin'), getDashboard);
router.get('/revenue', authMiddleware, roleGuard('admin'), getRevenue);
router.get('/users/growth', authMiddleware, roleGuard('admin'), getUserGrowth);

// ============================================================================
// LISTING & MANAGEMENT
// ============================================================================
router.get('/hospitals', authMiddleware, roleGuard('admin'), listHospitals);
router.get('/doctors', authMiddleware, roleGuard('admin'), listDoctors);
router.get('/users', authMiddleware, roleGuard('admin'), listUsers);
router.get('/patients', authMiddleware, roleGuard('admin'), listPatients);

// ============================================================================
// USER MANAGEMENT (Patients/Common)
// ============================================================================
router.get('/users/:id', authMiddleware, roleGuard('admin'), getUser);
router.patch('/users/:id/status', authMiddleware, roleGuard('admin'), updateUserStatus);
router.delete('/users/:id', authMiddleware, roleGuard('admin'), deleteUser);

// ============================================================================
// VERIFICATION WORKFLOWS
// ============================================================================
router.patch('/hospitals/:id/verify', authMiddleware, roleGuard('admin'), verifyHospital);
router.delete('/hospitals/:id', authMiddleware, roleGuard('admin'), deleteHospital);
router.patch('/hospitals/:id/status', authMiddleware, roleGuard('admin'), updateHospitalStatus);
router.post('/hospitals/:id/request-documents', authMiddleware, roleGuard('admin'), requestDocuments);
router.patch('/doctors/:id/verify', authMiddleware, roleGuard('admin'), verifyDoctor);
router.patch('/doctors/:id/status', authMiddleware, roleGuard('admin'), updateDoctorStatus);

// ============================================================================
// ANALYTICS & TRENDS
// ============================================================================
router.get('/analytics/overview', authMiddleware, roleGuard('admin'), getAnalyticsOverview);
router.get('/analytics/trends/appointments', authMiddleware, roleGuard('admin'), getAppointmentTrends);
router.get('/analytics/trends/revenue', authMiddleware, roleGuard('admin'), getRevenueTrends);
router.get('/analytics/trends/users', authMiddleware, roleGuard('admin'), getUserTrends);

// ============================================================================
// AUDIT LOGS
// ============================================================================
router.get('/audit-logs', authMiddleware, roleGuard('admin'), listAuditLogs);
router.get('/audit-logs/:id', authMiddleware, roleGuard('admin'), getAuditLog);

// ============================================================================
// SETTINGS
// ============================================================================
router.get('/settings', authMiddleware, roleGuard('admin'), getSettings);
router.get('/settings/:key', authMiddleware, roleGuard('admin'), getSetting);
router.put('/settings/:key', authMiddleware, roleGuard('admin'), updateSetting);
router.post('/settings/:key/reset', authMiddleware, roleGuard('admin'), resetSetting);

// ============================================================================
// REPORTS
// ============================================================================
router.post('/reports/:type', authMiddleware, roleGuard('admin'), generateReport);
router.get('/reports/scheduled', authMiddleware, roleGuard('admin'), getScheduledReports);

export const adminRoutes = router;
export default router;
