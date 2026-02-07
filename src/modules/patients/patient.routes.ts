import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { getDashboardData } from './patient.controller.js';

const router = Router();

/**
 * @route GET /api/v1/patients/dashboard
 * @desc Get aggregated patient dashboard data
 * @access Private (Patient)
 */
router.get(
    '/dashboard',
    authMiddleware,
    roleGuard('patient'),
    getDashboardData
);

export default router;
