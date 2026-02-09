import { Request, Response } from 'express';
import { paymentService } from './payment.service.js';
import { paymentPolicy } from './payment.policy.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { CreateOrderInput, VerifyPaymentInput, ProcessRefundInput, PaymentFilters, CashfreeCallbackInput } from './payment.types.js';

/**
 * Payment Controller - Handles HTTP requests for payments
 */

/**
 * Create payment order
 * POST /api/v1/payments/orders
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateOrderInput;

  const order = await paymentService.createOrder(user.userId, data);
  return sendCreated(res, order, 'Payment order created');
});

/**
 * Get payment configuration for client
 * GET /api/v1/payments/config/:appointmentId
 * Returns provider-specific config for client-side payment initialization
 */
export const getPaymentConfig = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { appointmentId } = req.params;

  const config = await paymentService.getPaymentConfig(user.userId, appointmentId);
  return sendSuccess(res, config, 'Payment configuration retrieved');
});

/**
 * Verify payment (Razorpay signature verification)
 * POST /api/v1/payments/verify
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as VerifyPaymentInput;

  const payment = await paymentService.verifyPayment(user.userId, data);
  return sendSuccess(res, payment, 'Payment verified successfully');
});

/**
 * Verify Cashfree payment callback (from redirect)
 * POST /api/v1/payments/cashfree/callback
 */
export const verifyCashfreeCallback = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { orderId } = req.body as CashfreeCallbackInput;

  if (!orderId) {
    throw new BadRequestError('Order ID is required');
  }

  const payment = await paymentService.verifyCashfreePayment(user.userId, orderId);
  return sendSuccess(res, payment, 'Payment verified successfully');
});

/**
 * Get payment status (for polling)
 * GET /api/v1/payments/:paymentId/status
 */
export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  const payment = await paymentService.getById(paymentId);

  if (!paymentPolicy.canViewPayment(user, payment)) {
    throw new ForbiddenError('You are not authorized to view this payment');
  }

  return sendSuccess(res, {
    id: payment.id,
    status: payment.status,
    paid_at: payment.paid_at,
  });
});

/**
 * Get payment by ID
 * GET /api/v1/payments/:paymentId
 */
export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as AuthenticatedRequest).user;

  const payment = await paymentService.getById(paymentId);

  if (!paymentPolicy.canViewPayment(user, payment)) {
    throw new ForbiddenError('You are not authorized to view this payment');
  }

  return sendSuccess(res, payment);
});

/**
 * List payments
 * GET /api/v1/payments
 */
export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query as unknown as PaymentFilters;

  // Enforce role-based filtering via policy check or override
  if (user.role === 'patient') filters.patient_id = user.userId;
  if (user.role === 'doctor') filters.doctor_id = user.doctorId;
  if (user.role === 'hospital') filters.hospital_id = user.hospitalId;

  if (!paymentPolicy.canListPayments(user, filters)) {
    throw new ForbiddenError('You are not authorized to list these payments');
  }

  const result = await paymentService.list(filters);

  return sendPaginated(
    res,
    result.payments,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit)
    }
  );
});

/**
 * Initiate refund
 * POST /api/v1/payments/:paymentId/refund
 */
export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const input = req.body as ProcessRefundInput;

  // Fetch payment to check ownership
  const payment = await paymentService.getById(paymentId);

  if (!paymentPolicy.canRefundPayment(user, payment)) {
    throw new ForbiddenError('You are not authorized to refund this payment');
  }

  const refund = await paymentService.processRefund(user.userId, user.role, { ...input, payment_id: paymentId });

  return sendSuccess(res, refund, 'Refund initiated successfully');
});

/**
 * Get payment stats
 * GET /api/v1/payments/stats
 */
export const getPaymentStats = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { date_from, date_to } = req.query as any;

  // Hospital/Doctor can only see their own stats
  const hospitalId = user.role === 'hospital' ? user.hospitalId : undefined;
  const doctorId = user.role === 'doctor' ? user.doctorId : undefined;

  const stats = await paymentService.getStats(hospitalId, doctorId, date_from, date_to);
  return sendSuccess(res, stats);
});

/**
 * Handle Razorpay webhook
 * POST /api/v1/payments/webhook/razorpay
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  await paymentService.handleWebhook(req.body, signature);
  return sendSuccess(res, null, 'Webhook processed');
});

/**
 * Handle Cashfree webhook
 * POST /api/v1/payments/webhook/cashfree
 */
export const handleCashfreeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  await paymentService.handleCashfreeWebhook(req.body, signature);
  return sendSuccess(res, null, 'Webhook processed');
});
