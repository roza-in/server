-- ============================================================
-- ROZX Healthcare Platform — Migration 005
-- Payments, Refunds & Financial Infrastructure
-- ============================================================
-- Depends on: 004 (appointments)
-- ============================================================

-- ======================== PAYMENTS ========================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  payment_number VARCHAR(30) UNIQUE,

  payment_type payment_type NOT NULL,

  -- Related entity
  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID,  -- FK added in 007_pharmacy

  -- Parties
  payer_user_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),

  -- Amount breakdown
  base_amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_payment_base_amount CHECK (base_amount > 0),
  platform_fee DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_payment_platform_fee CHECK (platform_fee >= 0),
  gst_amount DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_payment_gst CHECK (gst_amount >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_payment_discount CHECK (discount_amount >= 0),
  total_amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_payment_total CHECK (total_amount > 0),

  -- Commission
  platform_commission DECIMAL(12,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 0,

  -- Net payable to hospital
  net_payable DECIMAL(12,2) NOT NULL,

  -- Cumulative refund tracker (prevents over-refund)
  total_refunded DECIMAL(12,2) DEFAULT 0,
  CONSTRAINT chk_refund_cap CHECK (total_refunded <= total_amount),

  currency VARCHAR(3) DEFAULT 'INR',

  payment_method payment_method NOT NULL,

  -- Gateway
  gateway_provider VARCHAR(50),
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  gateway_response JSONB,

  -- Cash (walk-in)
  cash_collected_by UUID REFERENCES users(id),
  cash_collected_at TIMESTAMPTZ,
  cash_receipt_number VARCHAR(50),

  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,

  -- Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,

  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,

  -- Audit
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_payer ON payments(payer_user_id);
CREATE INDEX idx_payments_hospital ON payments(hospital_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_date ON payments(created_at DESC);
CREATE INDEX idx_payments_gateway ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX idx_payments_order_id ON payments(gateway_order_id) WHERE gateway_order_id IS NOT NULL;

-- ======================== PAYMENT STATE LOG ========================
-- Immutable audit trail for every payment status transition

CREATE TABLE payment_state_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,

  from_status payment_status,
  to_status payment_status NOT NULL,

  changed_by UUID REFERENCES users(id),
  change_source VARCHAR(50) NOT NULL DEFAULT 'system',  -- system, webhook, admin, user
  reason TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_state_log_payment ON payment_state_log(payment_id);
CREATE INDEX idx_payment_state_log_date ON payment_state_log(created_at DESC);

-- ======================== REFUNDS ========================

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  refund_number VARCHAR(30) UNIQUE,

  payment_id UUID NOT NULL REFERENCES payments(id),

  refund_amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_refund_amount CHECK (refund_amount > 0),

  reason refund_reason NOT NULL,
  reason_details TEXT,

  -- Cancellation policy
  cancellation_fee DECIMAL(12,2) DEFAULT 0,
  policy_applied TEXT,

  status refund_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,

  -- Initiated by
  initiated_by UUID NOT NULL REFERENCES users(id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Approval
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Gateway
  gateway_refund_id VARCHAR(100),
  gateway_response JSONB,

  completed_at TIMESTAMPTZ,

  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_date ON refunds(created_at DESC);

-- ======================== GST LEDGER ========================

CREATE TABLE gst_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  transaction_type VARCHAR(50) NOT NULL,
  transaction_id UUID NOT NULL,
  transaction_number VARCHAR(50),

  invoice_number VARCHAR(50) UNIQUE,
  invoice_date DATE NOT NULL,

  seller_gstin VARCHAR(20),
  seller_name VARCHAR(255),
  buyer_gstin VARCHAR(20),
  buyer_name VARCHAR(255),

  place_of_supply VARCHAR(50) NOT NULL,

  hsn_sac_code VARCHAR(20) NOT NULL,
  description TEXT,

  -- Amounts
  taxable_amount DECIMAL(12,2) NOT NULL,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(12,2) DEFAULT 0,
  total_tax DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,

  is_credit BOOLEAN DEFAULT false,

  is_filed BOOLEAN DEFAULT false,
  filed_in_return VARCHAR(20),
  filing_date DATE,

  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gst_invoice ON gst_ledger(invoice_number);
CREATE INDEX idx_gst_transaction ON gst_ledger(transaction_type, transaction_id);
CREATE INDEX idx_gst_date ON gst_ledger(transaction_date);
CREATE INDEX idx_gst_filing ON gst_ledger(is_filed, invoice_date);

-- ======================== GATEWAY WEBHOOK EVENTS ========================
-- Idempotent webhook processor — prevents duplicate processing

CREATE TABLE gateway_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Dedup key: provider + event_id must be unique
  gateway_provider VARCHAR(50) NOT NULL,
  gateway_event_id VARCHAR(255) NOT NULL,

  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Processing
  status webhook_processing_status NOT NULL DEFAULT 'received',
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Linked entities (populated after processing)
  payment_id UUID REFERENCES payments(id),
  refund_id UUID REFERENCES refunds(id),

  -- Signature verification
  signature_verified BOOLEAN DEFAULT false,

  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(gateway_provider, gateway_event_id)
);

CREATE INDEX idx_webhook_status ON gateway_webhook_events(status);
CREATE INDEX idx_webhook_provider ON gateway_webhook_events(gateway_provider, event_type);
CREATE INDEX idx_webhook_retry ON gateway_webhook_events(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_webhook_received ON gateway_webhook_events(received_at DESC);

-- ======================== PAYMENT DISPUTES ========================

CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,

  dispute_type VARCHAR(50) NOT NULL DEFAULT 'chargeback',
  gateway_dispute_id VARCHAR(100),

  amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,

  status dispute_status NOT NULL DEFAULT 'open',

  -- Evidence
  evidence_submitted JSONB,
  evidence_due_by TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  amount_deducted DECIMAL(12,2) DEFAULT 0,

  -- Gateway response
  gateway_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_payment ON payment_disputes(payment_id);
CREATE INDEX idx_disputes_status ON payment_disputes(status);
CREATE INDEX idx_disputes_date ON payment_disputes(created_at DESC);

-- ======================== FORWARD FK: Appointments → Payments ========================
-- payment_id and payment_status added here since payments table is defined after appointments

ALTER TABLE appointments ADD COLUMN payment_id UUID REFERENCES payments(id);
ALTER TABLE appointments ADD COLUMN payment_status payment_status;
CREATE INDEX idx_appointments_payment ON appointments(payment_id) WHERE payment_id IS NOT NULL;

-- ======================== CASH PAYMENT VERIFICATION (I6) ========================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cash_verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cash_verified_at TIMESTAMPTZ;

-- ======================== PERFORMANCE INDEXES (I9) ========================

-- payments.appointment_id — frequently joined from appointment queries
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id
  ON payments (appointment_id);

-- payments — unverified cash payments filter (I6 reconciliation)
CREATE INDEX IF NOT EXISTS idx_payments_cash_unverified
  ON payments (payment_method, cash_collected_at)
  WHERE payment_method = 'cash' AND cash_verified_by IS NULL;
