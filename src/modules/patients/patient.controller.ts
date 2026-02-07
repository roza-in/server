import { Request, Response } from 'express';
import { patientService } from './patient.service.js';
import { sendSuccess } from '../../common/responses/index.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Patient Controller - Handles dashboard and patient-specific data
 */

/**
 * Get patient dashboard data
 * GET /api/v1/patients/dashboard
 */
export const getDashboardData = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const data = await patientService.getDashboardData(user.userId);
    return sendSuccess(res, data);
});
