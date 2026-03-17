import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { getDashboardData } from './patient.controller.js';
import { getBalance, getTransactions, addCredit } from './credit.controller.js';

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

// ============================================================================
// CREDITS / WALLET (I1 — patient_credits table)
// ============================================================================

/**
 * @route GET /api/v1/patients/credits/balance
 * @desc Get current user's credit wallet balance
 * @access Private (Patient)
 */
router.get('/credits/balance', authMiddleware, roleGuard('patient'), getBalance);

/**
 * @route GET /api/v1/patients/credits/transactions
 * @desc Get credit transaction history
 * @access Private (Patient)
 */
router.get('/credits/transactions', authMiddleware, roleGuard('patient'), getTransactions);

/**
 * @route POST /api/v1/patients/:userId/credits
 * @desc Add credit to a patient account (admin refund, promo)
 * @access Private (Admin)
 */
router.post('/:userId/credits', authMiddleware, roleGuard('admin'), addCredit);

export { router as patientRoutes };
export default router;
