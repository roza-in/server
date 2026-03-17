import { Request, Response } from 'express';
import { adminService } from './admin.service.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendPaginated } from '../../common/responses/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  VerifyHospitalBody,
  VerifyDoctorBody,
  SettingUpdateBody,
} from './admin.validator.js';

/**
 * Admin Controller — HTTP handlers for the admin panel
 */

// ============================================================================
// DASHBOARD & STATS
// ============================================================================

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  return sendSuccess(res, stats);
});

export const getRevenue = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getRevenue();
  return sendSuccess(res, stats);
});

export const getUserGrowth = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminService.getUserGrowth(req.query as any);
  return sendSuccess(res, data);
});

// ============================================================================
// HOSPITALS
// ============================================================================

export const listHospitals = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listHospitals(req.query);
  return sendPaginated(res, result.hospitals, result.meta);
});

export const verifyHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as VerifyHospitalBody;
  const authUser = (req as AuthenticatedRequest).user;

  const result = await adminService.verifyHospital(id, body);
  return sendSuccess(res, result, 'Hospital verification status updated');
});

export const updateHospitalStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  await adminService.updateHospitalStatus(id, is_active);
  return sendSuccess(res, null, `Hospital ${is_active ? 'activated' : 'deactivated'} successfully`);
});

export const deleteHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await adminService.deleteHospital(id);
  return sendSuccess(res, null, 'Hospital deactivated successfully');
});

// ============================================================================
// DOCTORS
// ============================================================================

export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listDoctors(req.query);
  return sendPaginated(res, result.doctors, result.meta);
});

export const verifyDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as VerifyDoctorBody;
  const doctor = await adminService.verifyDoctor(id, body);
  return sendSuccess(res, doctor, 'Doctor verification updated');
});

export const updateDoctorStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  await adminService.updateDoctorStatus(id, is_active);
  return sendSuccess(res, null, `Doctor profile ${is_active ? 'activated' : 'disabled'} on platform`);
});

// ============================================================================
// USERS
// ============================================================================

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listUsers(req.query);
  return sendPaginated(res, result.users, result.meta);
});

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listUsers({ ...req.query, role: 'patient' });
  return sendPaginated(res, result.users, result.meta);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await adminService.getUser(id);
  return sendSuccess(res, user);
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  await adminService.updateUserStatus(id, is_active);
  return sendSuccess(res, null, `User account ${is_active ? 'activated' : 'deactivated'} successfully`);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await adminService.deleteUser(id);
  return sendSuccess(res, null, 'User account deactivated successfully');
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listAuditLogs(req.query);
  return sendPaginated(res, result.logs, result.meta);
});

export const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const log = await adminService.getAuditLog(id);
  return sendSuccess(res, log);
});

// ============================================================================
// SETTINGS (platform_config)
// ============================================================================

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await adminService.getSettings();
  return sendSuccess(res, settings);
});

export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const setting = await adminService.getSetting(key);
  return sendSuccess(res, setting);
});

export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body as SettingUpdateBody;
  const setting = await adminService.updateSetting(key, value);
  return sendSuccess(res, setting, 'Setting updated');
});

export const resetSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  await adminService.resetSetting(key);
  return sendSuccess(res, null, 'Setting reset');
});

// ============================================================================
// REPORTS
// ============================================================================

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const url = await adminService.generateReport(type, req.query);
  return sendSuccess(res, url, 'Report generated');
});

export const getScheduledReports = asyncHandler(async (_req: Request, res: Response) => {
  const reports = await adminService.getScheduledReports();
  return sendSuccess(res, reports);
});

// ============================================================================
// ANALYTICS & TRENDS
// ============================================================================

export const getAnalyticsOverview = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getAnalyticsOverview();
  return sendSuccess(res, stats);
});

export const getAppointmentTrends = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
  const trends = await adminService.getAppointmentTrends(period);
  return sendSuccess(res, trends);
});

export const getRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
  const trends = await adminService.getRevenueTrends(period);
  return sendSuccess(res, trends);
});

export const getUserTrends = asyncHandler(async (req: Request, res: Response) => {
  const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
  const trends = await adminService.getUserTrends(period);
  return sendSuccess(res, trends);
});
