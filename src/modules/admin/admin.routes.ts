import { Router } from 'express';
import {
  // Dashboard
  getDashboard,
  getRevenue,
  getUserGrowth,
  // Hospitals
  listHospitals,
  getHospital,
  verifyHospital,
  deleteHospital,
  updateHospitalStatus,
  // Doctors
  listDoctors,
  getDoctor,
  verifyDoctor,
  updateDoctorStatus,
  // Users
  listUsers,
  listPatients,
  getUser,
  updateUserStatus,
  updateAdminTier,
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
  // Pharmacy Users
  createPharmacyUser,
  listPharmacyUsers,
  getPharmacyUser,
  updatePharmacyUserStatus,
  deletePharmacyUser,
  // Bulk Operations
  bulkApproveSettlements,
  bulkApproveRefunds,
} from './admin.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  roleGuard,
  financeAdmin,
  securityAdmin,
  supportAdmin,
  opsAdmin,
  superAdminOnly,
} from '../../middlewares/role.middleware.js';
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
  createPharmacyUserSchema,
  listPharmacyUsersSchema,
  pharmacyUserParamsSchema,
  updatePharmacyUserStatusSchema,
  listAuditLogsQuerySchema,
  updateAdminTierSchema,
} from './admin.validator.js';

import * as adminFinanceController from './admin-finance.controller.js';
import * as adminFinanceValidator from './admin-finance.validator.js';
import * as adminSecurityController from './admin-security.controller.js';
import * as adminSecurityValidator from './admin-security.validator.js';
import * as adminOpsController from './admin-ops.controller.js';
import * as adminOpsValidator from './admin-ops.validator.js';

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
router.get('/hospitals/:id', validate(hospitalParamsSchema), getHospital);
router.patch('/hospitals/:id/verify', validate(verifyHospitalSchema), verifyHospital);
router.patch('/hospitals/:id/status', validate(updateHospitalStatusSchema), updateHospitalStatus);
router.delete('/hospitals/:id', validate(hospitalParamsSchema), deleteHospital);

// ============================================================================
// DOCTORS
// ============================================================================
router.get('/doctors', validate(listDoctorsQuerySchema), listDoctors);
router.get('/doctors/:id', validate(doctorParamsSchema), getDoctor);
router.patch('/doctors/:id/verify', validate(verifyDoctorSchema), verifyDoctor);
router.patch('/doctors/:id/status', validate(updateDoctorStatusSchema), updateDoctorStatus);

// ============================================================================
// USERS
// ============================================================================
router.get('/users', validate(listUsersQuerySchema), listUsers);
router.get('/patients', listPatients);
router.get('/users/:id', validate(getUserParamsSchema), getUser);
router.patch('/users/:id/status', validate(updateUserStatusSchema), updateUserStatus);
router.patch('/users/:id/tier', superAdminOnly, validate(updateAdminTierSchema), updateAdminTier);
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
router.get('/audit-logs', validate(listAuditLogsQuerySchema), listAuditLogs);
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

// ============================================================================
// PHARMACY USERS
// ============================================================================
router.post('/pharmacy-users', validate(createPharmacyUserSchema), createPharmacyUser);
router.get('/pharmacy-users', validate(listPharmacyUsersSchema), listPharmacyUsers);
router.get('/pharmacy-users/:id', validate(pharmacyUserParamsSchema), getPharmacyUser);
router.patch('/pharmacy-users/:id/status', validate(updatePharmacyUserStatusSchema), updatePharmacyUserStatus);
router.delete('/pharmacy-users/:id', validate(pharmacyUserParamsSchema), deletePharmacyUser);

// ============================================================================
// FINANCIAL GOVERNANCE
// ============================================================================

// ── Disputes ──
router.get('/finance/disputes', financeAdmin, validate(adminFinanceValidator.listDisputesSchema), adminFinanceController.listDisputes);
router.get('/finance/disputes/stats', financeAdmin, adminFinanceController.getDisputeStats);
router.get('/finance/disputes/:id', financeAdmin, validate(adminFinanceValidator.disputeParamsSchema), adminFinanceController.getDispute);
router.patch('/finance/disputes/:id', financeAdmin, validate(adminFinanceValidator.updateDisputeSchema), adminFinanceController.updateDispute);

// ── GST Ledger ──
router.get('/finance/gst-ledger', financeAdmin, validate(adminFinanceValidator.listGstSchema), adminFinanceController.listGstEntries);
router.get('/finance/gst-ledger/stats', financeAdmin, adminFinanceController.getGstStats);
router.post('/finance/gst-ledger/mark-filed', financeAdmin, validate(adminFinanceValidator.markGstFiledSchema), adminFinanceController.markGstFiled);

// ── Financial Ledger (read-only) ──
router.get('/finance/ledger', financeAdmin, validate(adminFinanceValidator.listLedgerSchema), adminFinanceController.listLedgerEntries);
router.get('/finance/ledger/summary', financeAdmin, adminFinanceController.getLedgerSummary);

// ── Reconciliation ──
router.get('/finance/reconciliation', financeAdmin, validate(adminFinanceValidator.listReconSchema), adminFinanceController.listReconRecords);
router.get('/finance/reconciliation/stats', financeAdmin, adminFinanceController.getReconStats);
router.patch('/finance/reconciliation/:id', financeAdmin, validate(adminFinanceValidator.resolveReconSchema), adminFinanceController.resolveRecon);
router.post('/finance/reconciliation/:id/write-off', financeAdmin, validate(adminFinanceValidator.reconParamsSchema), adminFinanceController.writeOffRecon);

// ── Hold Funds ──
router.get('/finance/hold-funds', financeAdmin, validate(adminFinanceValidator.listHoldFundsSchema), adminFinanceController.listHoldFunds);
router.get('/finance/hold-funds/stats', financeAdmin, adminFinanceController.getHoldFundStats);
router.post('/finance/hold-funds/:id/release', financeAdmin, validate(adminFinanceValidator.releaseHoldFundSchema), adminFinanceController.releaseHoldFund);

// ── Finance: Commission Slabs ──
router.get('/finance/commission-slabs', financeAdmin, adminFinanceController.listCommissionSlabs);
router.post('/finance/commission-slabs', financeAdmin, validate(adminFinanceValidator.createCommissionSlabSchema), adminFinanceController.createCommissionSlab);
router.patch('/finance/commission-slabs/:id', financeAdmin, validate(adminFinanceValidator.updateCommissionSlabSchema), adminFinanceController.updateCommissionSlab);
router.patch('/finance/commission-slabs/:id/toggle', financeAdmin, validate(adminFinanceValidator.toggleCommissionSlabSchema), adminFinanceController.toggleCommissionSlab);

// ── Bulk Operations ──
router.post('/finance/settlements/bulk-approve', financeAdmin, bulkApproveSettlements);
router.post('/finance/refunds/bulk-approve', financeAdmin, bulkApproveRefunds);

// =============================================================================
// CRITICAL SECURITY MONITORING
// =============================================================================

// ── Security: Sessions ──
router.get('/security/sessions', securityAdmin, validate(adminSecurityValidator.listSecurityLogsSchema), adminSecurityController.listActiveSessions);
router.delete('/security/sessions/:id', securityAdmin, validate(adminSecurityValidator.revokeSessionSchema), adminSecurityController.revokeSession);
router.delete('/security/sessions/user/:userId', securityAdmin, validate(adminSecurityValidator.revokeUserSessionsSchema), adminSecurityController.revokeAllUserSessions);

// ── Security: Login History ──
router.get('/security/login-history', securityAdmin, validate(adminSecurityValidator.listSecurityLogsSchema), adminSecurityController.listLoginActivity);

// ── Security: OTP Monitoring ──
router.get('/security/otp-monitoring', securityAdmin, validate(adminSecurityValidator.listSecurityLogsSchema), adminSecurityController.listOtpActivity);
router.get('/security/otp-monitoring/stats', securityAdmin, adminSecurityController.getOtpStats);

// ── Security: Webhooks ──
router.get('/security/webhooks', securityAdmin, validate(adminSecurityValidator.listSecurityLogsSchema), adminSecurityController.listWebhookEvents);
router.get('/security/webhooks/stats', securityAdmin, adminSecurityController.getWebhookStats);
router.post('/security/webhooks/:id/retry', securityAdmin, validate(adminSecurityValidator.retryWebhookSchema), adminSecurityController.retryWebhook);

// ── Security: API Keys ──
router.get('/security/api-keys', securityAdmin, validate(adminSecurityValidator.listSecurityLogsSchema), adminSecurityController.listApiKeys);
router.post('/security/api-keys', securityAdmin, validate(adminSecurityValidator.createApiKeySchema), adminSecurityController.createApiKey);
router.delete('/security/api-keys/:id', securityAdmin, validate(adminSecurityValidator.revokeApiKeySchema), adminSecurityController.revokeApiKey);

// =============================================================================
// OPERATIONAL MONITORING (Phase 4)
// =============================================================================

// ── Notifications ──
router.get('/ops/notifications', opsAdmin, validate(adminOpsValidator.listNotificationQueueSchema), adminOpsController.listNotificationQueue);
router.post('/ops/notifications/:id/retry', opsAdmin, validate(adminOpsValidator.retryNotificationSchema), adminOpsController.retryNotification);

// ── Support Tickets ──
router.get('/ops/support', supportAdmin, validate(adminOpsValidator.listSupportTicketsSchema), adminOpsController.listSupportTickets);
router.get('/ops/support/:id', validate(adminOpsValidator.getSupportTicketSchema), adminOpsController.getSupportTicket);
router.patch('/ops/support/:id', validate(adminOpsValidator.updateTicketSchema), adminOpsController.updateTicket);
router.post('/ops/support/:id/messages', validate(adminOpsValidator.addTicketMessageSchema), adminOpsController.addTicketMessage);

// ── Hospital Verifications ──
router.get('/ops/verifications', opsAdmin, validate(adminOpsValidator.listHospitalVerificationsSchema), adminOpsController.listHospitalVerifications);
router.post('/ops/verifications/:id/resolve', opsAdmin, validate(adminOpsValidator.resolveVerificationSchema), adminOpsController.resolveVerification);

// ── Scheduled Reports ──
router.get('/ops/reports', opsAdmin, validate(adminOpsValidator.listScheduledReportsSchema), adminOpsController.listScheduledReports);
router.patch('/ops/reports/:id/toggle', validate(adminOpsValidator.toggleReportSchema), adminOpsController.toggleReportStatus);

// ── System Health ──
router.get('/ops/health', opsAdmin, adminOpsController.getOperationalStats);
router.get('/ops/health/logs', opsAdmin, validate(adminOpsValidator.listSystemLogsSchema), adminOpsController.listSystemLogs);

export const adminRoutes = router;
export default router;
