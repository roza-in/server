// @ts-nocheck
import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

/**
 * Payment validators using Zod
 */

// Create order schema
export const createOrderSchema = z.object({
  body: z.object({
    appointmentId: uuidSchema,
  }),
});

// Verify payment schema
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
});

// Get payment schema
export const getPaymentSchema = z.object({
  params: z.object({
    paymentId: uuidSchema,
  }),
});

// List payments schema
export const listPaymentsSchema = z.object({
  query: z.object({
    patientId: uuidSchema.optional(),
    hospitalId: uuidSchema.optional(),
    status: z.enum(['pending', 'captured', 'refunded', 'failed']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// Refund payment schema
export const refundPaymentSchema = z.object({
  params: z.object({
    paymentId: uuidSchema,
  }),
  body: z.object({
    amount: z.number().positive().optional(), // For partial refund
    reason: z.string().max(500).optional(),
  }),
});

// Webhook schema
export const razorpayWebhookSchema = z.object({
  body: z.object({
    event: z.string(),
    payload: z.object({
      payment: z.object({
        entity: z.object({
          id: z.string(),
          order_id: z.string(),
          amount: z.number(),
          currency: z.string(),
          status: z.string(),
          method: z.string().optional(),
        }),
      }).optional(),
      refund: z.object({
        entity: z.object({
          id: z.string(),
          payment_id: z.string(),
          amount: z.number(),
          status: z.string(),
        }),
      }).optional(),
    }),
  }),
});

// Export types
export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>['body'];
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>['query'];
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;


