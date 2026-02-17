import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  listSettlements,
  getSettlement,
  calculateSettlement,
  getMySettlements,
  approveSettlement,
  initiatePayout,
  completeSettlement,
  getSettlementStats,
} from './settlement.controller.js';
import {
  listSettlementsSchema,
  getSettlementSchema,
  calculateSettlementSchema,
  getMySettlementsSchema,
  approveSettlementSchema,
  initiatePayoutSchema,
  completeSettlementSchema,
  getSettlementStatsSchema,
} from './settlement.validator.js';

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/v1/settlements/stats
 * @desc  Settlement statistics (admin dashboard)
 * @access Admin
 */
router.get('/stats', roleGuard('admin'), validate(getSettlementStatsSchema), getSettlementStats);

/**
 * @route GET /api/v1/settlements/my
 * @desc  Get settlements for the current hospital user
 * @access Hospital
 */
router.get('/my', roleGuard('hospital'), validate(getMySettlementsSchema), getMySettlements);

/**
 * @route GET /api/v1/settlements
 * @desc  List all settlements with filters
 * @access Admin
 */
router.get('/', roleGuard('admin'), validate(listSettlementsSchema), listSettlements);

/**
 * @route POST /api/v1/settlements
 * @desc  Calculate and create a new settlement
 * @access Admin
 */
router.post('/', roleGuard('admin'), validate(calculateSettlementSchema), calculateSettlement);

/**
 * @route GET /api/v1/settlements/:settlementId
 * @desc  Get settlement detail with line items
 * @access Admin, Hospital
 */
router.get('/:settlementId', roleGuard('admin', 'hospital'), validate(getSettlementSchema), getSettlement);

/**
 * @route POST /api/v1/settlements/:settlementId/approve
 * @desc  Approve a pending settlement
 * @access Admin
 */
router.post('/:settlementId/approve', roleGuard('admin'), validate(approveSettlementSchema), approveSettlement);

/**
 * @route POST /api/v1/settlements/:settlementId/initiate
 * @desc  Initiate payout for an approved settlement
 * @access Admin
 */
router.post('/:settlementId/initiate', roleGuard('admin'), validate(initiatePayoutSchema), initiatePayout);

/**
 * @route POST /api/v1/settlements/:settlementId/complete
 * @desc  Mark settlement completed with UTR number
 * @access Admin
 */
router.post('/:settlementId/complete', roleGuard('admin'), validate(completeSettlementSchema), completeSettlement);

export const settlementRoutes = router;

export default router;
