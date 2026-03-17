import type {
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  RefundStatus,
  RefundReason,
  SettlementStatus,
} from '../../types/database.types.js';

/**
 * Payment Module Types - Aligned with DB schema (005_payments_refunds.sql)
 */

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentListItem {
  id: string;
  payment_number: string | null;
  appointment_id: string | null;
  payment_type: PaymentType;
  total_amount: number;
  status: PaymentStatus;
  payment_method: PaymentMethod;
  patient_name: string | null;
  hospital_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PaymentWithDetails {
  id: string;
  payment_number: string | null;
  payment_type: PaymentType;
  appointment_id: string | null;
  medicine_order_id: string | null;
  payer_user_id: string;
  hospital_id: string | null;
  base_amount: number;
  platform_fee: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  platform_commission: number;
  commission_rate: number;
  net_payable: number;
  total_refunded: number;
  currency: string;
  payment_method: PaymentMethod;
  gateway_provider: string | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  gateway_response: Record<string, unknown> | null;
  status: PaymentStatus;
  status_reason: string | null;
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  appointment?: {
    id: string;
    appointment_number: string;
    scheduled_date: string;
    scheduled_start: string;
    consultation_type: string;
  } | null;
  payer?: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  hospital?: {
    id: string;
    name: string;
  } | null;
  refunds?: Refund[];
}

// ============================================================================
// Refund Types
// ============================================================================

export interface Refund {
  id: string;
  refund_number: string | null;
  payment_id: string;
  refund_amount: number;
  reason: RefundReason;
  reason_details: string | null;
  cancellation_fee: number;
  policy_applied: string | null;
  status: RefundStatus;
  status_reason: string | null;
  initiated_by: string;
  initiated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  gateway_refund_id: string | null;
  gateway_response: Record<string, unknown> | null;
  completed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundInput {
  payment_id: string;
  amount?: number;
  reason: string;
}

// ============================================================================
// Settlement Types
// ============================================================================

export interface Settlement {
  id: string;
  settlement_number: string | null;
  entity_type: string;
  entity_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  refunds_amount: number;
  commission_amount: number;
  tds_amount: number;
  other_deductions: number;
  deduction_details: Record<string, unknown> | null;
  net_payable: number;
  payout_account_id: string | null;
  payment_mode: string | null;
  utr_number: string | null;
  status: SettlementStatus;
  status_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementWithDetails extends Settlement {
  entity?: {
    id: string;
    name: string;
  } | null;
  payments?: PaymentListItem[];
}

// ============================================================================
// Credits Types
// ============================================================================

export interface PatientCredit {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  credit_account_id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AddCreditsInput {
  user_id: string;
  amount: number;
  type: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  expires_at?: string;
}

// ============================================================================
// Razorpay Types
// ============================================================================

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
  notes: Record<string, unknown>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  method: string;
  description: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: Record<string, unknown>;
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  notes: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  speed_requested: 'normal' | 'optimum';
  speed_processed: 'normal' | 'instant';
  created_at: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateOrderInput {
  appointment_id: string;
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  receipt: string;
  key_id?: string;
  notes: {
    appointment_id: string;
    patient_id: string;
    hospital_id?: string;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  provider?: 'razorpay' | 'cashfree';
  payment_link?: string; // Cashfree redirect URL
  payment_session_id?: string; // Cashfree payment session
}

/**
 * Payment config response for client-side gateway initialization
 */
export interface PaymentConfigResponse {
  provider: 'razorpay' | 'cashfree';
  appointment_id: string;
  amount: number;
  currency: string;
  // Razorpay-specific
  key_id?: string;
  order_id?: string;
  // Cashfree-specific
  payment_link?: string;
  payment_session_id?: string;
  // Common
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface VerifyPaymentInput {
  gateway_order_id: string;
  gateway_payment_id: string;
  gateway_signature?: string;
  provider: string;
}

/**
 * Cashfree callback input (from redirect)
 */
export interface CashfreeCallbackInput {
  orderId: string; // order_id from Cashfree
}

export interface ProcessRefundInput {
  payment_id: string;
  refund_type?: 'full' | 'partial';
  amount?: number;
  reason: string;
  speed?: 'normal' | 'optimum';
}

// ============================================================================
// Filter Types
// ============================================================================

export interface PaymentFilters {
  patient_id?: string;
  doctor_id?: string;
  hospital_id?: string;
  status?: PaymentStatus | PaymentStatus[];
  payment_type?: PaymentType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'total_amount' | 'completed_at';
  sort_order?: 'asc' | 'desc';
}

export interface RefundFilters {
  payment_id?: string;
  status?: RefundStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface SettlementFilters {
  entity_type?: string;
  entity_id?: string;
  status?: SettlementStatus;
  period_from?: string;
  period_to?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Stats Types
// ============================================================================

export interface PaymentStats {
  total_revenue: number;
  platform_fees: number;
  net_payable: number;
  total_refunds: number;
  transaction_count: number;
  pending_settlements: number;
}

export interface RevenueBreakdown {
  period: string;
  revenue: number;
  platform_fee: number;
  refunds: number;
  net_revenue: number;
  transaction_count: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface RazorpayWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: { entity: RazorpayPayment };
    refund?: { entity: RazorpayRefund };
    order?: { entity: RazorpayOrder };
  };
  created_at: number;
}

