-- ============================================================
-- ROZX Healthcare Platform - Migration 005
-- Payments, Refunds, GST & Settlements (Supabase Ready)
-- ============================================================

-- ============================================================
-- PAYMENTS (All monetary transactions)
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  payment_number VARCHAR(30) UNIQUE,
  
  -- Type
  payment_type payment_type NOT NULL,
  
  -- Related entity
  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID,  -- FK added after pharmacy migration
  
  -- Parties
  payer_user_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Amount breakdown
  base_amount DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Commission (Admin controlled)
  platform_commission DECIMAL(12,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 0,  -- Percentage
  
  -- Net payable to hospital/pharmacy
  net_payable DECIMAL(12,2) NOT NULL,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Payment method
  payment_method payment_method NOT NULL,
  
  -- Gateway details (for online payments)
  gateway_provider VARCHAR(50),  -- razorpay, stripe, etc
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  gateway_signature VARCHAR(255),
  gateway_response JSONB,
  
  -- Cash payment (for walk-in via reception)
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
  
  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,
  
  -- Audit
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_payer ON payments(payer_user_id);
CREATE INDEX idx_payments_hospital ON payments(hospital_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_date ON payments(created_at DESC);
CREATE INDEX idx_payments_gateway ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;

-- ============================================================
-- REFUNDS
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  refund_number VARCHAR(30) UNIQUE,
  
  -- Original payment
  payment_id UUID NOT NULL REFERENCES payments(id),
  
  -- Amount
  refund_amount DECIMAL(12,2) NOT NULL,
  
  -- Reason (Admin controlled policy)
  reason refund_reason NOT NULL,
  reason_details TEXT,
  
  -- Cancellation policy applied
  cancellation_fee DECIMAL(12,2) DEFAULT 0,
  policy_applied TEXT,
  
  -- Status
  status refund_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  
  -- Initiated by
  initiated_by UUID NOT NULL REFERENCES users(id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Approval (Admin only for override)
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Gateway
  gateway_refund_id VARCHAR(100),
  gateway_response JSONB,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_date ON refunds(created_at DESC);

-- ============================================================
-- GST LEDGER (Tax compliance)
-- ============================================================

CREATE TABLE IF NOT EXISTS gst_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Transaction reference
  transaction_type VARCHAR(50) NOT NULL,  -- payment, refund, settlement
  transaction_id UUID NOT NULL,
  transaction_number VARCHAR(50),
  
  -- Invoice
  invoice_number VARCHAR(50) UNIQUE,
  invoice_date DATE NOT NULL,
  
  -- Parties
  seller_gstin VARCHAR(20),
  seller_name VARCHAR(255),
  buyer_gstin VARCHAR(20),
  buyer_name VARCHAR(255),
  
  -- Place of supply
  place_of_supply VARCHAR(50) NOT NULL,
  
  -- HSN/SAC code
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
  
  -- Credit/Debit
  is_credit BOOLEAN DEFAULT false,  -- true for refunds
  
  -- Status
  is_filed BOOLEAN DEFAULT false,
  filed_in_return VARCHAR(20),  -- GSTR-1, GSTR-3B
  filing_date DATE,
  
  -- Timestamps
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gst_invoice ON gst_ledger(invoice_number);
CREATE INDEX idx_gst_transaction ON gst_ledger(transaction_type, transaction_id);
CREATE INDEX idx_gst_date ON gst_ledger(transaction_date);
CREATE INDEX idx_gst_filing ON gst_ledger(is_filed, invoice_date);

-- ============================================================
-- SETTLEMENTS (Hospital payouts)
-- ============================================================

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  settlement_number VARCHAR(30) UNIQUE,
  
  -- Settlement for
  entity_type VARCHAR(50) NOT NULL,  -- hospital, pharmacy
  entity_id UUID NOT NULL,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Amounts
  gross_amount DECIMAL(12,2) NOT NULL,
  refunds_amount DECIMAL(12,2) DEFAULT 0,
  commission_amount DECIMAL(12,2) DEFAULT 0,
  tds_amount DECIMAL(12,2) DEFAULT 0,  -- TDS if applicable
  other_deductions DECIMAL(12,2) DEFAULT 0,
  deduction_details JSONB,
  net_payable DECIMAL(12,2) NOT NULL,
  
  -- Payment details
  payment_mode VARCHAR(50),
  bank_account JSONB,  -- { bank, account_masked, ifsc }
  utr_number VARCHAR(50),
  
  -- Status
  status settlement_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  
  -- Approved by
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Processed
  processed_at TIMESTAMPTZ,
  
  -- Invoice
  invoice_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlements_entity ON settlements(entity_type, entity_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(period_start, period_end);

-- ============================================================
-- SETTLEMENT LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS settlement_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  
  -- Source transaction
  transaction_type VARCHAR(50) NOT NULL,  -- payment, refund
  transaction_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  
  -- Amounts
  gross_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,
  
  -- Details
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_items ON settlement_line_items(settlement_id);

-- ============================================================
-- PLATFORM CONFIGURATION (Admin controlled)
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  
  -- Type
  config_type VARCHAR(50) DEFAULT 'general',
  
  -- History
  updated_by UUID REFERENCES users(id),
  previous_value JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default platform configurations (Admin only can modify)
INSERT INTO platform_config (config_key, config_value, config_type, description) VALUES
  ('consultation_commission_percent', '8', 'commission', 'Platform commission on consultation fees'),
  ('medicine_commission_percent', '5', 'commission', 'Platform commission on medicine orders'),
  ('cancellation_policy', '{"free_hours": 4, "partial_after_hours": 24, "partial_percent": 50}', 'policy', 'Cancellation and refund policy'),
  ('gst_rate', '18', 'tax', 'GST rate for platform services'),
  ('tds_threshold', '50000', 'tax', 'TDS deduction threshold for settlements'),
  ('tds_rate', '2', 'tax', 'TDS rate for settlements above threshold')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- CANCELLATION POLICY TABLE (Admin controlled)
-- ============================================================

CREATE TABLE IF NOT EXISTS cancellation_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Time windows (in hours before appointment)
  free_cancellation_hours INTEGER DEFAULT 24,
  partial_refund_hours INTEGER DEFAULT 4,
  partial_refund_percent INTEGER DEFAULT 50,
  
  -- Fees
  cancellation_fee_fixed DECIMAL(10,2) DEFAULT 0,
  cancellation_fee_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Applicability
  applies_to_online BOOLEAN DEFAULT true,
  applies_to_in_person BOOLEAN DEFAULT true,
  applies_to_walk_in BOOLEAN DEFAULT false,
  
  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Admin control
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default policy
INSERT INTO cancellation_policies (name, description, is_default) VALUES
  ('Standard Policy', 'Free cancellation 24h before, 50% refund within 24h, no refund within 4h', true)
ON CONFLICT DO NOTHING;
