-- ============================================================
-- ROZX Healthcare Platform - Migration 005
-- Payment System: Payments, Refunds, Settlements, GST, Ratings
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- PAYMENTS TABLE
-- Complete payment tracking with Razorpay integration
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Payment Details
  amount DECIMAL(10,2) NOT NULL,                  -- Total charged to patient
  consultation_fee DECIMAL(10,2) NOT NULL,        -- Base consultation fee
  platform_fee DECIMAL(10,2) DEFAULT 0,           -- ROZX platform fee
  platform_fee_percentage DECIMAL(4,2),           -- Platform fee % applied
  gst_amount DECIMAL(10,2) DEFAULT 0,             -- GST @ 18%
  gst_percentage DECIMAL(4,2) DEFAULT 18.00,
  
  -- Distribution
  doctor_amount DECIMAL(10,2),                    -- Amount for doctor
  hospital_amount DECIMAL(10,2),                  -- Amount for hospital
  rozx_amount DECIMAL(10,2),                      -- ROZX revenue
  
  -- Gateway Details
  gateway VARCHAR(50) DEFAULT 'razorpay',         -- razorpay, cashfree
  
  -- Razorpay Specific
  razorpay_order_id VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100) UNIQUE,
  razorpay_signature VARCHAR(255),
  razorpay_invoice_id VARCHAR(100),
  
  -- Payment Method
  payment_method payment_method,
  payment_method_details JSONB,                   -- Card last 4, bank name, etc.
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Status
  status payment_status NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Webhook
  webhook_received_at TIMESTAMPTZ,
  webhook_payload JSONB,
  
  -- Invoice
  invoice_number VARCHAR(50) UNIQUE,
  invoice_url TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_doctor ON payments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_hospital ON payments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- ============================================================
-- REFUNDS TABLE
-- Refund processing and tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  
  -- Refund Details
  refund_type refund_type NOT NULL,
  refund_percentage DECIMAL(5,2),                 -- 100, 75, 50, 0
  
  -- Amounts
  original_amount DECIMAL(10,2) NOT NULL,         -- Original payment
  refund_amount DECIMAL(10,2) NOT NULL,           -- Amount to refund
  platform_fee_refund DECIMAL(10,2),              -- Platform fee refund (if any)
  
  -- Gateway Details
  razorpay_refund_id VARCHAR(100) UNIQUE,
  
  -- Status
  status refund_status NOT NULL DEFAULT 'pending',
  
  -- Reason
  reason TEXT,
  cancelled_by UUID REFERENCES users(id),         -- Who cancelled the appointment
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Credit (for doctor_cancelled / technical_failure)
  credit_amount DECIMAL(10,2),                    -- Extra credit given
  credit_expires_at TIMESTAMPTZ,
  
  -- Webhook
  webhook_payload JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refund indexes
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_appointment ON refunds(appointment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_razorpay ON refunds(razorpay_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON refunds(created_at DESC);

-- ============================================================
-- HOSPITAL SETTLEMENTS TABLE
-- Track payouts to hospitals
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Hospital
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  
  -- Settlement Period
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  
  -- Summary
  total_consultations INTEGER NOT NULL,
  total_revenue DECIMAL(12,2) NOT NULL,           -- Total collected
  total_platform_fees DECIMAL(12,2) NOT NULL,     -- Platform fees deducted
  total_gst DECIMAL(12,2) NOT NULL,               -- GST collected
  total_refunds DECIMAL(12,2) DEFAULT 0,          -- Refunds in period
  net_settlement DECIMAL(12,2) NOT NULL,          -- Amount to pay hospital
  
  -- Bank Transfer
  bank_reference VARCHAR(100),
  transfer_id VARCHAR(100),                       -- Razorpay transfer ID
  
  -- Status
  status settlement_status NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Invoice
  invoice_number VARCHAR(50) UNIQUE,
  invoice_url TEXT,
  
  -- Metadata
  payment_breakdown JSONB,                        -- Detailed breakdown
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlement indexes
CREATE INDEX IF NOT EXISTS idx_settlements_hospital ON hospital_settlements(hospital_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON hospital_settlements(settlement_period_start, settlement_period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON hospital_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_created ON hospital_settlements(created_at DESC);

-- ============================================================
-- SETTLEMENT LINE ITEMS TABLE
-- Individual payments included in settlement
-- ============================================================

CREATE TABLE IF NOT EXISTS settlement_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  settlement_id UUID NOT NULL REFERENCES hospital_settlements(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  
  -- Amounts
  consultation_fee DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  hospital_amount DECIMAL(10,2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Line item indexes
CREATE INDEX IF NOT EXISTS idx_line_items_settlement ON settlement_line_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_line_items_payment ON settlement_line_items(payment_id);

-- ============================================================
-- PATIENT WALLET / CREDITS TABLE
-- Credits given for compensation
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Credit Details
  amount DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) NOT NULL,                 -- Remaining balance
  
  -- Source
  source VARCHAR(50) NOT NULL,                    -- refund_credit, promotional, referral
  source_reference_id UUID,                       -- Refund ID, promo code ID, etc.
  
  -- Validity
  expires_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',            -- active, used, expired
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit indexes
CREATE INDEX IF NOT EXISTS idx_credits_patient ON patient_credits(patient_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON patient_credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_expires ON patient_credits(expires_at);

-- ============================================================
-- CREDIT TRANSACTIONS TABLE
-- Track credit usage
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  credit_id UUID NOT NULL REFERENCES patient_credits(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  
  -- Transaction
  transaction_type VARCHAR(20) NOT NULL,          -- credit, debit
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  
  -- Reference
  appointment_id UUID REFERENCES appointments(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Description
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transaction indexes
CREATE INDEX IF NOT EXISTS idx_credit_txn_credit ON credit_transactions(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_patient ON credit_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_created ON credit_transactions(created_at DESC);

-- ============================================================
-- RATINGS TABLE
-- Doctor and hospital ratings with reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Ratings (1-5)
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  doctor_rating INTEGER CHECK (doctor_rating >= 1 AND doctor_rating <= 5),
  hospital_rating INTEGER CHECK (hospital_rating >= 1 AND hospital_rating <= 5),
  
  -- Specific Ratings
  wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),
  staff_behavior_rating INTEGER CHECK (staff_behavior_rating >= 1 AND staff_behavior_rating <= 5),
  consultation_quality_rating INTEGER CHECK (consultation_quality_rating >= 1 AND consultation_quality_rating <= 5),
  
  -- Review Text
  review TEXT,
  
  -- Anonymous Review
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Doctor Response
  doctor_response TEXT,
  doctor_responded_at TIMESTAMPTZ,
  
  -- Hospital Response
  hospital_response TEXT,
  hospital_responded_at TIMESTAMPTZ,
  
  -- Moderation
  is_visible BOOLEAN DEFAULT true,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES users(id),
  hidden_at TIMESTAMPTZ,
  
  -- Verification
  is_verified BOOLEAN DEFAULT true,               -- Verified purchase
  
  -- Helpful Count
  helpful_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rating indexes
CREATE INDEX IF NOT EXISTS idx_ratings_appointment ON ratings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_ratings_patient ON ratings(patient_id);
CREATE INDEX IF NOT EXISTS idx_ratings_doctor ON ratings(doctor_id);
CREATE INDEX IF NOT EXISTS idx_ratings_hospital ON ratings(hospital_id);
CREATE INDEX IF NOT EXISTS idx_ratings_overall ON ratings(overall_rating);
CREATE INDEX IF NOT EXISTS idx_ratings_visible ON ratings(is_visible);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON ratings(created_at DESC);

-- ============================================================
-- RATING HELPFULNESS TABLE
-- Track helpful votes on reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS rating_helpfulness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  is_helpful BOOLEAN NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(rating_id, user_id)
);

-- Helpfulness indexes
CREATE INDEX IF NOT EXISTS idx_helpfulness_rating ON rating_helpfulness(rating_id);
CREATE INDEX IF NOT EXISTS idx_helpfulness_user ON rating_helpfulness(user_id);

-- ============================================================
-- INVOICES TABLE
-- Store generated invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Invoice Number
  invoice_number VARCHAR(50) NOT NULL UNIQUE,     -- ROZX/[Year]/[Seq]
  
  -- Type
  invoice_type VARCHAR(50) NOT NULL,              -- patient, hospital, settlement
  
  -- Parties
  from_entity_type VARCHAR(50),                   -- rozx, hospital
  from_entity_id UUID,
  to_entity_type VARCHAR(50),                     -- patient, hospital
  to_entity_id UUID NOT NULL,
  
  -- References
  payment_id UUID REFERENCES payments(id),
  settlement_id UUID REFERENCES hospital_settlements(id),
  
  -- Amounts
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Tax Details
  tax_breakdown JSONB,                            -- GST CGST SGST breakdown
  
  -- From Details (for invoice header)
  from_name VARCHAR(255),
  from_address TEXT,
  from_gstin VARCHAR(20),
  from_pan VARCHAR(15),
  
  -- To Details
  to_name VARCHAR(255),
  to_address TEXT,
  to_gstin VARCHAR(20),
  to_pan VARCHAR(15),
  
  -- Line Items
  line_items JSONB NOT NULL,
  
  -- PDF
  pdf_url TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'generated',         -- generated, sent, paid
  
  -- Timestamps
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_to_entity ON invoices(to_entity_type, to_entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment ON invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_settlement ON invoices(settlement_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);

-- ============================================================
-- END OF MIGRATION 005
-- ============================================================
