import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
    listRefunds,
    getRefund,
    createRefund,
    processRefund,
    getRefundStats,
} from './refund.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/v1/refunds/stats
 * @desc Get refund statistics
 * @access Admin
 */
router.get('/stats', roleGuard('admin'), getRefundStats);

/**
 * @route GET /api/v1/refunds
 * @desc List all refunds
 * @access Admin, Hospital
 */
router.get('/', roleGuard('admin', 'hospital'), listRefunds);

/**
 * @route POST /api/v1/refunds
 * @desc Create a refund request
 * @access Admin, Hospital
 */
router.post('/', roleGuard('admin', 'hospital'), createRefund);

/**
 * @route GET /api/v1/refunds/:refundId
 * @desc Get refund by ID
 * @access Admin, Hospital
 */
router.get('/:refundId', roleGuard('admin', 'hospital'), getRefund);

/**
 * @route POST /api/v1/refunds/:refundId/process
 * @desc Process refund (approve/reject)
 * @access Admin
 */
router.post('/:refundId/process', roleGuard('admin'), processRefund);

export const refundRoutes = router;

export default router;

