/**
 * Pharmacy Settlement Routes
 * Express routes for pharmacy-specific settlement management
 */

import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware.js';
import { roleGuard } from '../../../middlewares/role.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
    calculateSettlement,
    listSettlements,
    getSettlement,
    processSettlement,
    completeSettlement,
    getMySettlements,
    getSettlementStats,
} from './settlement.controller.js';
import {
    calculateSettlementSchema,
    processSettlementSchema,
    listSettlementsSchema,
} from './settlement.validator.js';

const router = Router();

router.use(authMiddleware);

// ============================================================================
// Statistics (must be before /:id to avoid conflict)
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/settlements/stats
 * @desc    Get pharmacy settlement statistics
 * @access  Pharmacy/Admin
 */
router.get('/stats', roleGuard('pharmacy', 'admin'), getSettlementStats);

// ============================================================================
// Hospital Routes
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/settlements/my
 * @desc    Get my hospital's pharmacy settlements
 * @access  Hospital
 */
router.get('/my', roleGuard('hospital'), getMySettlements);

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/settlements
 * @desc    List all pharmacy settlements
 * @access  Admin
 */
router.get('/', roleGuard('pharmacy', 'admin'), validate(listSettlementsSchema), listSettlements);

/**
 * @route   POST /api/v1/pharmacy/settlements
 * @desc    Calculate new pharmacy settlement
 * @access  Admin
 */
router.post('/', roleGuard('admin'), validate(calculateSettlementSchema), calculateSettlement);

/**
 * @route   GET /api/v1/pharmacy/settlements/:id
 * @desc    Get settlement by ID
 * @access  Admin/Hospital
 */
router.get('/:id', roleGuard('pharmacy', 'admin', 'hospital'), getSettlement);

/**
 * @route   POST /api/v1/pharmacy/settlements/:id/process
 * @desc    Process settlement (start payout)
 * @access  Admin
 */
router.post('/:id/process', roleGuard('admin'), validate(processSettlementSchema), processSettlement);

/**
 * @route   POST /api/v1/pharmacy/settlements/:id/complete
 * @desc    Mark settlement as completed
 * @access  Admin
 */
router.post('/:id/complete', roleGuard('admin'), completeSettlement);

export default router;
