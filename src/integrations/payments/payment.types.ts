/**
 * Payment Integration Types
 *
 * Supports multiple providers (Razorpay, Cashfree) via a common interface.
 * Active provider is admin-switchable via system_settings or PAYMENT_PROVIDER env.
 */

// ── Provider names ──────────────────────────────────────────────────────────
export type PaymentProviderName = 'razorpay' | 'cashfree';

// ── Payment order ───────────────────────────────────────────────────────────
export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  provider_order_id: string;
  /** Cashfree redirect payment link (not set for Razorpay) */
  payment_link?: string;
}

// ── Payment refund ──────────────────────────────────────────────────────────
export interface PaymentRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  speed?: 'normal' | 'optimum';
  notes?: Record<string, string>;
}

// ── Normalized order status ─────────────────────────────────────────────────
export interface PaymentOrderStatus {
  id: string;
  status: 'created' | 'pending' | 'captured' | 'failed' | 'cancelled';
  /** Gateway-specific payment method (upi, card, etc.) */
  method?: string;
  /** Latest payment ID from the gateway */
  gateway_payment_id?: string;
  /** Raw provider response for debugging */
  raw?: unknown;
}

// ── Parsed webhook event ────────────────────────────────────────────────────
export interface WebhookEvent {
  type: string;
  data: {
    order?: Record<string, any>;
    payment?: Record<string, any>;
    refund?: Record<string, any>;
  };
}

// ── Provider interface ──────────────────────────────────────────────────────
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** Create a payment order */
  createOrder(data: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<PaymentOrder>;

  /** Fetch a specific payment by gateway payment ID */
  fetchPayment(paymentId: string): Promise<any>;

  /** Fetch order status by order ID (normalized) */
  fetchOrderStatus(orderId: string): Promise<PaymentOrderStatus>;

  /** Create a refund against a payment */
  createRefund(
    paymentId: string,
    data: { amount?: number; speed?: 'normal' | 'optimum'; notes?: Record<string, string> },
  ): Promise<PaymentRefund>;

  /** Verify checkout signature (Razorpay: order_id|payment_id HMAC, Cashfree: fetch order status) */
  verifySignature?(data: any): boolean;

  /** Verify webhook signature (HMAC) */
  verifyWebhookSignature?(payload: string | Buffer, signature: string): boolean;

  /** Parse a webhook body into a normalized event */
  parseWebhookEvent?(body: any): WebhookEvent;
}

// ── Provider status (for admin dashboard) ───────────────────────────────────
export interface PaymentProviderStatus {
  name: PaymentProviderName;
  enabled: boolean;
  isActive: boolean;
  configured: boolean;
  lastError?: string;
}
