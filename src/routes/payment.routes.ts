import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  createOrder,
  verifyPayment,
  getPayment,
  listPayments,
  refundPayment,
  handleWebhook,
  getPaymentStats,
} from '../modules/payments/payment.controller.js';

const router = Router();

/**
 * @route POST /api/v1/payments/create-order
 * @desc Create a Razorpay order for appointment payment
 * @access Private (patient)
 */
router.post(
  '/create-order',
  authenticate,
  requireRole('patient'),
  createOrder
);

/**
 * @route POST /api/v1/payments/verify
 * @desc Verify Razorpay payment after completion
 * @access Private
 */
router.post('/verify', authenticate, verifyPayment);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc Get payment by ID
 * @access Private
 */
router.get('/:paymentId', authenticate, getPayment);

/**
 * @route GET /api/v1/payments
 * @desc List payments (filtered by role)
 * @access Private
 */
router.get('/', authenticate, listPayments);

/**
 * @route POST /api/v1/payments/:paymentId/refund
 * @desc Initiate refund for a payment
 * @access Private (admin, hospital)
 */
router.post(
  '/:paymentId/refund',
  authenticate,
  requireRole('admin', 'hospital'),
  refundPayment
);

/**
 * @route GET /api/v1/payments/stats
 * @desc Get payment statistics
 * @access Private (admin, hospital, doctor)
 */
router.get(
  '/stats/summary',
  authenticate,
  requireRole('admin', 'hospital', 'doctor'),
  getPaymentStats
);

/**
 * @route POST /api/v1/payments/webhook
 * @desc Handle Razorpay webhook events
 * @access Public (verified via signature)
 */
router.post('/webhook', handleWebhook);

export const paymentRoutes = router;
