import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess } from '../../common/responses/success.response.js';
import { adminOpsService } from './admin-ops.service.js';

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const listNotificationQueue = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminOpsService.listNotificationQueue(req.query);
    return sendSuccess(res, data, 'Notification queue fetched', 200, meta);
});

export const retryNotification = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminOpsService.retryNotification(req.params.id);
    return sendSuccess(res, result, 'Notification retry initiated');
});

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export const listSupportTickets = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminOpsService.listSupportTickets(req.query);
    return sendSuccess(res, data, 'Support tickets fetched', 200, meta);
});

export const getSupportTicket = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminOpsService.getSupportTicket(req.params.id);
    return sendSuccess(res, result, 'Support ticket details fetched');
});

export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminOpsService.updateTicket(req.params.id, req.body);
    return sendSuccess(res, result, 'Support ticket updated');
});

export const addTicketMessage = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.id; // Assuming user is attached by auth middleware
    const result = await adminOpsService.addTicketMessage(req.params.id, adminId, req.body);
    return sendSuccess(res, result, 'Message added to ticket', 201);
});

// ============================================================================
// HOSPITAL VERIFICATIONS
// ============================================================================

export const listHospitalVerifications = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminOpsService.listHospitalVerifications(req.query);
    return sendSuccess(res, data, 'Hospital verifications fetched', 200, meta);
});

export const resolveVerification = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.id;
    const result = await adminOpsService.resolveVerification(req.params.id, adminId, req.body);
    return sendSuccess(res, result, 'Verification resolved');
});

// ============================================================================
// SCHEDULED REPORTS
// ============================================================================

export const listScheduledReports = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminOpsService.listScheduledReports(req.query);
    return sendSuccess(res, data, 'Scheduled reports fetched', 200, meta);
});

export const toggleReportStatus = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminOpsService.toggleReportStatus(req.params.id, req.body.isActive);
    return sendSuccess(res, result, 'Report status toggled');
});

// ============================================================================
// SYSTEM LOGS
// ============================================================================

export const listSystemLogs = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminOpsService.listSystemLogs(req.query);
    return sendSuccess(res, data, 'System logs fetched', 200, meta);
});

// ============================================================================
// OVERVIEW STATS
// ============================================================================

export const getOperationalStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminOpsService.getOperationalStats();
    return sendSuccess(res, stats, 'Operational stats fetched');
});
