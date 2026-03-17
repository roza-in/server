import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess } from '../../common/responses/success.response.js';
import { adminSecurityService } from './admin-security.service.js';

// ============================================================================
// SESSIONS
// ============================================================================

export const listActiveSessions = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminSecurityService.listActiveSessions(req.query);
    return sendSuccess(res, data, 'Active sessions fetched', 200, meta);
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSecurityService.revokeSession(req.params.id);
    return sendSuccess(res, result, 'Session revoked');
});

export const revokeAllUserSessions = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSecurityService.revokeAllUserSessions(req.params.id);
    return sendSuccess(res, result, 'All user sessions revoked');
});

// ============================================================================
// LOGIN HISTORY
// ============================================================================

export const listLoginActivity = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminSecurityService.listLoginActivity(req.query);
    return sendSuccess(res, data, 'Login activity fetched', 200, meta);
});

// ============================================================================
// OTP MONITORING
// ============================================================================

export const listOtpActivity = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminSecurityService.listOtpActivity(req.query);
    return sendSuccess(res, data, 'OTP activity fetched', 200, meta);
});

export const getOtpStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminSecurityService.getOtpStats();
    return sendSuccess(res, stats, 'OTP stats fetched');
});

// ============================================================================
// WEBHOOKS
// ============================================================================

export const listWebhookEvents = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminSecurityService.listWebhookEvents(req.query);
    return sendSuccess(res, data, 'Webhook events fetched', 200, meta);
});

export const getWebhookStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminSecurityService.getWebhookStats();
    return sendSuccess(res, stats, 'Webhook stats fetched');
});

export const retryWebhook = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSecurityService.retryWebhook(req.params.id);
    return sendSuccess(res, result, 'Webhook retry initiated');
});

// ============================================================================
// API KEYS
// ============================================================================

export const listApiKeys = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminSecurityService.listApiKeys(req.query);
    return sendSuccess(res, data, 'API keys fetched', 200, meta);
});

export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSecurityService.createApiKey(req.body);
    return sendSuccess(res, result, 'API key created', 201);
});

export const revokeApiKey = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminSecurityService.revokeApiKey(req.params.id);
    return sendSuccess(res, result, 'API key revoked');
});
