import { Request, Response } from 'express';
import { adminService } from './admin.service.js';
import { logger } from '../../common/logger.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendPaginated, responses } from '../../common/response.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import {
  listUsersQuerySchema,
  userGrowthQuerySchema,
  verifyHospitalSchema,
  requestDocumentsSchema,
  ticketFiltersSchema,
  ticketUpdateSchema,
  ticketReplySchema,
  settingUpdateSchema,
  reportTypeSchema,
  reportFiltersSchema,
} from './admin.validator.js';

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  return sendSuccess(res, stats);
});

export const getRevenue = asyncHandler(async (req: Request, res: Response) => {
  const stats = await adminService.getRevenue(req.query);
  return sendSuccess(res, stats);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const filters = listUsersQuerySchema.parse(req.query);
  const result = await adminService.listUsers(filters);
  return sendPaginated(res, result.users, result.meta);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await adminService.getUser(id);
  return sendSuccess(res, user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const user = await adminService.updateUser(id, data);
  return sendSuccess(res, user, 'User updated');
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await adminService.deleteUser(id);
  return responses.deleted(res);
});

export const banUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, duration } = req.body as { reason?: string; duration?: number };
  const user = await adminService.banUser(id, reason, duration);
  return sendSuccess(res, user, 'User banned');
});

export const unbanUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await adminService.unbanUser(id);
  return sendSuccess(res, user, 'User unbanned');
});

export const getUserGrowth = asyncHandler(async (req: Request, res: Response) => {
  const q = userGrowthQuerySchema.parse(req.query);
  const stats = await adminService.getUserGrowth(q);
  return sendSuccess(res, stats);
});

export const listPendingHospitals = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Record<string, any>;
  const result = await adminService.listPendingHospitalVerifications(filters);
  return sendPaginated(res, result.hospitals, result.meta);
});

export const verifyHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = verifyHospitalSchema.parse(req.body);
  const hospital = await adminService.verifyHospital(id, body);
  return sendSuccess(res, hospital, 'Hospital verification updated');
});

export const requestDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = requestDocumentsSchema.parse(req.body);
  const result = await adminService.requestDocuments(id, body.documentTypes, body.message);
  return sendSuccess(res, result, 'Request sent');
});

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const filters = ticketFiltersSchema.parse(req.query);
  const result = await adminService.listTickets(filters);
  return sendPaginated(res, result.tickets, result.meta);
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ticket = await adminService.getTicket(id);
  return sendSuccess(res, ticket);
});

export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = ticketUpdateSchema.parse(req.body);
  const ticket = await adminService.updateTicket(id, data);
  return sendSuccess(res, ticket, 'Ticket updated');
});

export const replyTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = ticketReplySchema.parse(req.body);
  const ticket = await adminService.replyTicket(id, body.message, body.attachments);
  return sendSuccess(res, ticket, 'Reply added');
});

export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { resolution } = req.body as { resolution?: string };
  const ticket = await adminService.closeTicket(id, resolution);
  return sendSuccess(res, ticket, 'Ticket closed');
});

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
