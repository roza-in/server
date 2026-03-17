/**
 * Medicine Return Routes
 * Express routes for medicine return/refund management
 */

import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware.js';
import { roleGuard } from '../../../middlewares/role.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
    createReturn,
    getMyReturns,
    getReturnById,
    getReturnByNumber,
    listReturns,
    reviewReturn,
    completePickup,
    getReturnStats,
} from './return.controller.js';
import {
    createReturnSchema,
    reviewReturnSchema,
    listReturnsSchema,
} from './return.validator.js';

const router = Router();

router.use(authMiddleware);

// ============================================================================
// Statistics (must be before /:id to avoid conflict)
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/returns/stats
 * @desc    Get return statistics
 * @access  Pharmacy/Admin
 */
router.get('/stats', roleGuard('pharmacy', 'admin'), getReturnStats);

// ============================================================================
// Admin / Pharmacy Routes
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/returns/all
 * @desc    List all returns
 * @access  Pharmacy/Admin
 */
router.get('/all', roleGuard('pharmacy', 'admin'), validate(listReturnsSchema), listReturns);

// ============================================================================
// Patient Routes
// ============================================================================

/**
 * @route   GET /api/v1/pharmacy/returns
 * @desc    Get my returns
 * @access  Patient
 */
router.get('/', validate(listReturnsSchema), getMyReturns);

/**
 * @route   GET /api/v1/pharmacy/returns/number/:returnNumber
 * @desc    Get return by return number
 * @access  Authenticated
 */
router.get('/number/:returnNumber', getReturnByNumber);

/**
 * @route   GET /api/v1/pharmacy/returns/:id
 * @desc    Get return by ID
 * @access  Authenticated
 */
router.get('/:id', getReturnById);

/**
 * @route   POST /api/v1/pharmacy/returns/:orderId
 * @desc    Create a return for an order
 * @access  Patient
 */
router.post('/:orderId', validate(createReturnSchema), createReturn);

// ============================================================================
// Review & Fulfillment
// ============================================================================

/**
 * @route   POST /api/v1/pharmacy/returns/:id/review
 * @desc    Approve or reject a return
 * @access  Pharmacy/Admin
 */
router.post('/:id/review', roleGuard('pharmacy', 'admin'), validate(reviewReturnSchema), reviewReturn);

/**
 * @route   POST /api/v1/pharmacy/returns/:id/pickup-complete
 * @desc    Mark pickup as completed
 * @access  Pharmacy/Admin
 */
router.post('/:id/pickup-complete', roleGuard('pharmacy', 'admin'), completePickup);

export default router;
