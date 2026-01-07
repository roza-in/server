// @ts-nocheck
import { Request, Response } from 'express';
import { paymentService } from './payment.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { CreateOrderInput, VerifyPaymentInput, ListPaymentsInput, RefundPaymentInput } from './payment.validator.js';

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
 * Verify payment
 * POST /api/v1/payments/verify
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as VerifyPaymentInput;
  const payment = await paymentService.verifyPayment(user.userId, data);
  return sendSuccess(res, payment, 'Payment verified successfully');
});

/**
 * Get payment by ID
 * GET /api/v1/payments/:paymentId
 */
export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const payment = await paymentService.getById(paymentId, user.userId, user.role);
  return sendSuccess(res, payment);
});

/**
 * List payments
 * GET /api/v1/payments
 */
export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query as unknown as ListPaymentsInput;
  const result = await paymentService.list(filters, user.userId, user.role);
  return sendPaginated(
    res,
    result.payments,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  );
});

/**
 * Initiate refund
 * POST /api/v1/payments/:paymentId/refund
 */
export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { amount, reason } = req.body;
  const payment = await paymentService.refund(paymentId, user.userId, user.role, amount, reason);
  return sendSuccess(res, payment, 'Refund initiated successfully');
});

/**
 * Get payment stats
 * GET /api/v1/payments/stats
 */
export const getPaymentStats = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { startDate, endDate } = req.query;
  
  // Hospital can only see their own stats
  const hospitalId = user.role === 'hospital' ? user.hospitalId : undefined;
  
  const stats = await paymentService.getStats(hospitalId, startDate as string, endDate as string);
  return sendSuccess(res, stats);
});

/**
 * Handle Razorpay webhook
 * POST /api/v1/payments/webhook
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { event, payload } = req.body;
  await paymentService.handleWebhook(event, payload);
  return sendSuccess(res, null, 'Webhook processed');
});

