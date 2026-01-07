import type {
  PaymentStatus,
  PaymentMethod,
  RefundStatus,
  SettlementStatus,
} from '../../types/database.types.js';

/**
 * Payment Module Types - Extended from database schema
 */

// ============================================================================
// Payment Types
// ============================================================================

export interface Payment {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  doctor_id: string | null;
  hospital_id: string | null;
  payment_type: 'appointment' | 'subscription' | 'credits' | 'other';
  amount: number;
  platform_fee: number;
  doctor_amount: number;
  hospital_amount: number;
  gst_amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  metadata: Record<string, any> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  appointment?: {
    id: string;
    booking_id: string;
    appointment_date: string;
    start_time: string;
    consultation_type: string;
  } | null;
  patient?: {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
  };
  doctor?: {
    id: string;
    full_name: string | null;
  } | null;
  hospital?: {
    id: string;
    name: string;
  } | null;
  refund?: Refund | null;
}

export interface PaymentListItem {
  id: string;
  appointment_id: string | null;
  payment_type: string;
  amount: number;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  patient_name: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  paid_at: string | null;
  created_at: string;
}

// ============================================================================
// Refund Types
// ============================================================================

export interface Refund {
  id: string;
  payment_id: string;
  appointment_id: string | null;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  refund_policy: 'full' | 'partial_75' | 'partial_50' | 'none';
  initiated_by: string;
  razorpay_refund_id: string | null;
  processed_at: string | null;
  created_at: string;
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
  hospital_id: string | null;
  doctor_id: string | null;
  period_start: string;
  period_end: string;
  total_amount: number;
  platform_fee: number;
  net_amount: number;
  transaction_count: number;
  status: SettlementStatus;
  bank_reference: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface SettlementWithDetails extends Settlement {
  hospital?: {
    id: string;
    name: string;
  } | null;
  doctor?: {
    id: string;
    full_name: string | null;
  } | null;
  payments?: PaymentListItem[];
}

// ============================================================================
// Credits Types
// ============================================================================

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_used: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'earned' | 'used' | 'expired' | 'refunded';
  source: 'referral' | 'promotion' | 'refund' | 'payment' | 'admin';
  reference_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AddCreditsInput {
  user_id: string;
  amount: number;
  source: 'referral' | 'promotion' | 'refund' | 'admin';
  description?: string;
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
  notes: Record<string, any>;
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
  notes: Record<string, any>;
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
  notes: Record<string, any>;
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
  key_id: string;
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
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ProcessRefundInput {
  payment_id: string;
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
  payment_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'amount' | 'paid_at';
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
  hospital_id?: string;
  doctor_id?: string;
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
  doctor_payouts: number;
  hospital_payouts: number;
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
