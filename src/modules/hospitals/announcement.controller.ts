import { Request, Response } from 'express';
import { announcementService } from './announcement.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Create announcement
 * POST /api/v1/hospitals/:hospitalId/announcements
 */
export const createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { hospitalId } = req.params;
    const result = await announcementService.create(hospitalId, user.userId, req.body);
    return sendCreated(res, result, 'Announcement created');
});

/**
 * Get active announcements (staff view)
 * GET /api/v1/hospitals/:hospitalId/announcements/active
 */
export const getActiveAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;
    const result = await announcementService.getActive(hospitalId);
    return sendSuccess(res, result);
});

/**
 * Get public announcements (patient view)
 * GET /api/v1/hospitals/:hospitalId/announcements/public
 */
export const getPublicAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;
    const result = await announcementService.getPublic(hospitalId);
    return sendSuccess(res, result);
});

/**
 * Get all announcements with pagination
 * GET /api/v1/hospitals/:hospitalId/announcements
 */
export const getAllAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await announcementService.getAll(hospitalId, parseInt(page), parseInt(limit));
    return sendPaginated(
        res,
        result.announcements,
        { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }
    );
});

/**
 * Update announcement
 * PATCH /api/v1/hospitals/:hospitalId/announcements/:announcementId
 */
export const updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, announcementId } = req.params;
    const result = await announcementService.update(announcementId, hospitalId, req.body);
    return sendSuccess(res, result, 'Announcement updated');
});

/**
 * Deactivate announcement
 * DELETE /api/v1/hospitals/:hospitalId/announcements/:announcementId
 */
export const deactivateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, announcementId } = req.params;
    await announcementService.deactivate(announcementId, hospitalId);
    return sendSuccess(res, null, 'Announcement deactivated');
});
