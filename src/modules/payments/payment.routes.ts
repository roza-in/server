import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { webhookApiKeyAuth, razorpayWebhookAuth } from '../../middlewares/webhook-auth.middleware.js';
import {
  createOrder,
  getPaymentConfig,
  verifyPayment,
  verifyCashfreeCallback,
  getPaymentStatus,
  getPayment,
  listPayments,
  refundPayment,
  handleWebhook,
  handleCashfreeWebhook,
  getPaymentStats,
} from './payment.controller.js';

import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';

const router = Router();

// =============================================================================
// Payment Configuration & Order Creation
// =============================================================================

/**
 * @route POST /api/v1/payments/create-order
 * @desc Create a payment order for appointment payment
 * @access Private (patient)
 */
router.post(
  '/create-order',
  authMiddleware,
  roleGuard('patient'),
  idempotencyMiddleware(),
  createOrder
);

/**
 * @route GET /api/v1/payments/config/:appointmentId
 * @desc Get payment configuration for client-side gateway initialization
 * @access Private (patient)
 */
router.get(
  '/config/:appointmentId',
  authMiddleware,
  roleGuard('patient'),
  getPaymentConfig
);

// =============================================================================
// Payment Verification
// =============================================================================

/**
 * @route POST /api/v1/payments/verify
 * @desc Verify Razorpay payment after completion
 * @access Private
 */
router.post(
  '/verify',
  authMiddleware,
  idempotencyMiddleware(),
  verifyPayment
);

/**
 * @route POST /api/v1/payments/cashfree/callback
 * @desc Verify Cashfree payment after redirect callback
 * @access Private
 */
router.post(
  '/cashfree/callback',
  authMiddleware,
  idempotencyMiddleware(),
  verifyCashfreeCallback
);

/**
 * @route GET /api/v1/payments/:paymentId/status
 * @desc Get payment status (for polling)
 * @access Private
 */
router.get('/:paymentId/status', authMiddleware, getPaymentStatus);

// =============================================================================
// Payment CRUD
// =============================================================================

/**
 * @route GET /api/v1/payments/stats/summary
 * @desc Get payment statistics
 * @access Private (admin, hospital, doctor)
 */
router.get(
  '/stats/summary',
  authMiddleware,
  roleGuard('admin', 'hospital', 'doctor'),
  getPaymentStats
);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc Get payment by ID
 * @access Private
 */
router.get('/:paymentId', authMiddleware, getPayment);

/**
 * @route GET /api/v1/payments
 * @desc List payments (filtered by role)
 * @access Private
 */
router.get('/', authMiddleware, listPayments);

/**
 * @route POST /api/v1/payments/:paymentId/refund
 * @desc Initiate refund for a payment
 * @access Private (admin, hospital)
 */
router.post(
  '/:paymentId/refund',
  authMiddleware,
  roleGuard('admin', 'hospital'),
  idempotencyMiddleware(),
  refundPayment
);

// =============================================================================
// Webhooks (Server-to-Server)
// =============================================================================

/**
 * @route POST /api/v1/payments/webhook/razorpay
 * @desc Handle Razorpay webhook events
 * @access Public (verified via API key + Razorpay signature)
 */
router.post(
  '/webhook/razorpay',
  webhookApiKeyAuth({ optional: true }),
  razorpayWebhookAuth,
  handleWebhook
);

/**
 * @route POST /api/v1/payments/webhook
 * @desc Legacy: Handle Razorpay webhook events (kept for backward compatibility)
 * @access Public (verified via API key + Razorpay signature)
 */
router.post(
  '/webhook',
  webhookApiKeyAuth({ optional: true }),
  razorpayWebhookAuth,
  handleWebhook
);

/**
 * @route POST /api/v1/payments/webhook/cashfree
 * @desc Handle Cashfree webhook events
 * @access Public (verified via x-webhook-signature)
 */
router.post(
  '/webhook/cashfree',
  handleCashfreeWebhook
);

export const paymentRoutes = router;
export default router;
