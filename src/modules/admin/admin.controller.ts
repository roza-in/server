import { Request, Response } from 'express';
import { adminService } from './admin.service.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import { sendSuccess, sendPaginated } from '../../common/responses/index.js';
import {
  userGrowthQuerySchema,
  verifyHospitalSchema,
  requestDocumentsSchema,
  verifyDoctorSchema,
  settingUpdateSchema,
  reportTypeSchema,
  reportFiltersSchema,
} from './admin.validator.js';

/**
 * Admin Controller - Refactored to match generic listing and trend paths
 */

// ============================================================================
// DASHBOARD & STATS
// ============================================================================

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  return sendSuccess(res, stats);
});

export const getRevenue = asyncHandler(async (req: Request, res: Response) => {
  const stats = await adminService.getRevenue(req.query);
  return sendSuccess(res, stats);
});

export const getUserGrowth = asyncHandler(async (req: Request, res: Response) => {
  const q = userGrowthQuerySchema.parse(req.query);
  const stats = await adminService.getUserGrowth(q);
  return sendSuccess(res, stats);
});

// ============================================================================
// LISTING & MANAGEMENT
// ============================================================================

export const listHospitals = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Record<string, any>;
  const result = await adminService.listHospitals(filters);
  return sendPaginated(res, result.hospitals, result.meta);
});

export const updateHospitalStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  await adminService.updateHospitalStatus(id, is_active);
  return sendSuccess(res, null, `Hospital ${is_active ? 'activated' : 'deactivated'} successfully`);
});

export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Record<string, any>;
  const result = await adminService.listDoctors(filters);
  return sendPaginated(res, result.doctors, result.meta);
});

export const updateDoctorStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;
  await adminService.updateDoctorStatus(id, is_active);
  return sendSuccess(res, null, `Doctor profile ${is_active ? 'activated' : 'disabled'} on platform`);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Record<string, any>;
  const result = await adminService.listUsers(filters);
  return sendPaginated(res, result.users, result.meta);
});

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const filters = { ...req.query, role: 'patient' } as any;
  const result = await adminService.listUsers(filters);
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
  return sendSuccess(res, null, 'User account deleted successfully');
});

export const verifyHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = verifyHospitalSchema.parse(req.body);
  const result = await adminService.verifyHospital(id, body);
  return sendSuccess(res, result, 'Hospital verification status updated');
});

export const deleteHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await adminService.deleteHospital(id);
  return sendSuccess(res, null, 'Hospital deleted successfully');
});

export const requestDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = requestDocumentsSchema.parse(req.body);
  const result = await adminService.requestDocuments(id, body.documentTypes, body.message);
  return sendSuccess(res, result, 'Request sent');
});

export const verifyDoctor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = verifyDoctorSchema.parse(req.body);
  const doctor = await adminService.verifyDoctor(id, body);
  return sendSuccess(res, doctor, 'Doctor verification updated');
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Record<string, any>;
  const result = await adminService.listAuditLogs(filters);
  return sendPaginated(res, result.logs, result.meta);
});

export const getAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const log = await adminService.getAuditLog(id);
  return sendSuccess(res, log);
});

// ============================================================================
// SETTINGS
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
  const body = settingUpdateSchema.parse(req.body);
  const setting = await adminService.updateSetting(key, body.value);
  return sendSuccess(res, setting, 'Setting updated');
});

export const resetSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const setting = await adminService.resetSetting(key);
  return sendSuccess(res, setting, 'Setting reset');
});

// ============================================================================
// REPORTS
// ============================================================================

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const type = reportTypeSchema.parse(req.params.type);
  const filters = reportFiltersSchema.parse(req.query);
  const url = await adminService.generateReport(type as string, filters);
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
