import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import { roleGuard } from '@/middlewares/role.middleware.js';
import {
    listSettlements,
    getSettlement,
    calculateSettlement,
    getMySettlements,
    initiatePayout,
    completeSettlement,
    getSettlementStats,
} from './settlement.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/v1/settlements/stats
 * @desc Get settlement statistics
 * @access Admin
 */
router.get('/stats', roleGuard('admin'), getSettlementStats);

/**
 * @route GET /api/v1/settlements/my
 * @desc Get my hospital settlements
 * @access Hospital
 */
router.get('/my', roleGuard('hospital'), getMySettlements);

/**
 * @route GET /api/v1/settlements
 * @desc List all settlements
 * @access Admin
 */
router.get('/', roleGuard('admin'), listSettlements);

/**
 * @route POST /api/v1/settlements
 * @desc Calculate new settlement
 * @access Admin
 */
router.post('/', roleGuard('admin'), calculateSettlement);

/**
 * @route GET /api/v1/settlements/:settlementId
 * @desc Get settlement by ID
 * @access Admin, Hospital
 */
router.get('/:settlementId', roleGuard('admin', 'hospital'), getSettlement);

/**
 * @route POST /api/v1/settlements/:settlementId/initiate
 * @desc Initiate payout
 * @access Admin
 */
router.post('/:settlementId/initiate', roleGuard('admin'), initiatePayout);

/**
 * @route POST /api/v1/settlements/:settlementId/complete
 * @desc Mark settlement as completed
 * @access Admin
 */
router.post('/:settlementId/complete', roleGuard('admin'), completeSettlement);

export const settlementRoutes = router;

export default router;

