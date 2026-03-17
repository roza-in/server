import { z } from 'zod';
import { uuidSchema, dateSchema, paginationSchema } from '../../common/validators.js';

/**
 * Payment validators using Zod — aligned with DB schema
 */

// Create order schema
export const createOrderSchema = z.object({
  body: z.object({
    appointment_id: uuidSchema,
  }),
});

// Verify payment schema (Razorpay)
export const verifyPaymentSchema = z.object({
  body: z.object({
    gateway_order_id: z.string().min(1),
    gateway_payment_id: z.string().min(1),
    gateway_signature: z.string().optional(),
    provider: z.enum(['razorpay', 'cashfree']).default('razorpay'),
  }),
});

// Cashfree callback schema
export const cashfreeCallbackSchema = z.object({
  body: z.object({
    orderId: z.string().min(1),
  }),
});

// Get payment schema
export const getPaymentSchema = z.object({
  params: z.object({
    paymentId: uuidSchema,
  }),
});

// Get payment config schema
export const getPaymentConfigSchema = z.object({
  params: z.object({
    appointmentId: uuidSchema,
  }),
});

// List payments schema
export const listPaymentsSchema = z.object({
  query: z.object({
    patient_id: uuidSchema.optional(),
    hospital_id: uuidSchema.optional(),
    status: z.enum([
      'pending', 'processing', 'completed', 'failed',
      'refunded', 'partially_refunded', 'expired', 'disputed',
    ]).optional(),
    payment_type: z.enum(['consultation', 'medicine_order', 'platform_fee']).optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    ...paginationSchema.shape,
  }),
});

// Refund payment schema
export const refundPaymentSchema = z.object({
  params: z.object({
    paymentId: uuidSchema,
  }),
  body: z.object({
    refund_type: z.enum(['full', 'partial']).default('full'),
    amount: z.number().positive().optional(),
    reason: z.string().max(500),
    speed: z.enum(['normal', 'optimum']).default('normal'),
  }),
});

// Stats query schema
export const paymentStatsSchema = z.object({
  query: z.object({
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
  }),
});

// Webhook schema (Razorpay)
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

// Export inferred types
export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>['body'];
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>['query'];
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>['body'];
export type PaymentStatsInput = z.infer<typeof paymentStatsSchema>['query'];
export type CashfreeCallbackValidated = z.infer<typeof cashfreeCallbackSchema>['body'];
