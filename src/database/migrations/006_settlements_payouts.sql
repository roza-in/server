-- ============================================================
-- ROZX Healthcare Platform — Migration 006
-- Settlements, Payouts & Financial Ledger
-- ============================================================
-- Depends on: 005 (payments)
-- ============================================================

-- ======================== PAYOUT ACCOUNTS ========================
-- Hospital gateway-level account references (NO raw bank details)

CREATE TABLE payout_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,

  -- Gateway references only
  gateway_provider VARCHAR(50) NOT NULL,              -- razorpay, cashfree
  gateway_account_id VARCHAR(100) NOT NULL,            -- linked_account_id / fund_account_id
  gateway_contact_id VARCHAR(100),                     -- razorpay contact id

  -- Display-only (masked)
  account_holder_name VARCHAR(255),
  bank_name VARCHAR(100),
  account_number_masked VARCHAR(20),                   -- ****1234
  ifsc_code VARCHAR(15),

  -- KYC
  kyc_status kyc_status NOT NULL DEFAULT 'not_started',
  kyc_verified_at TIMESTAMPTZ,

  -- Payout config
  settlement_frequency settlement_frequency DEFAULT 'weekly',
  min_payout_amount DECIMAL(12,2) DEFAULT 500.00,

  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(hospital_id, gateway_provider)
);

CREATE INDEX idx_payout_accounts_hospital ON payout_accounts(hospital_id);
CREATE INDEX idx_payout_accounts_gateway ON payout_accounts(gateway_provider, gateway_account_id);
CREATE INDEX idx_payout_accounts_active ON payout_accounts(hospital_id, is_active) WHERE is_active = true;

-- ======================== SETTLEMENTS ========================
-- FK: ON DELETE RESTRICT — financial records must never cascade-delete

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  settlement_number VARCHAR(30) UNIQUE,

  -- Entity
  entity_type VARCHAR(50) NOT NULL,     -- hospital, pharmacy
  entity_id UUID NOT NULL,              -- hospital_id or pharmacy identifier

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amounts
  gross_amount DECIMAL(12,2) NOT NULL,
  refunds_amount DECIMAL(12,2) DEFAULT 0,
  commission_amount DECIMAL(12,2) DEFAULT 0,
  tds_amount DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  deduction_details JSONB,
  net_payable DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_settlement_net_payable CHECK (net_payable >= 0),

  -- Payout reference
  payout_account_id UUID REFERENCES payout_accounts(id),
  payment_mode VARCHAR(50),
  utr_number VARCHAR(50),

  -- Status
  status settlement_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,

  -- Approval
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  processed_at TIMESTAMPTZ,

  invoice_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlements_entity ON settlements(entity_type, entity_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX idx_settlements_payout_account ON settlements(payout_account_id) WHERE payout_account_id IS NOT NULL;

-- ======================== SETTLEMENT LINE ITEMS ========================
-- FK: ON DELETE RESTRICT — line items must not vanish

CREATE TABLE settlement_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,

  transaction_type VARCHAR(50) NOT NULL,
  transaction_id UUID NOT NULL,
  transaction_date DATE NOT NULL,

  gross_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL,

  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_items ON settlement_line_items(settlement_id);
CREATE INDEX idx_settlement_items_txn ON settlement_line_items(transaction_type, transaction_id);

-- ======================== PAYOUTS ========================
-- Actual money transfers to hospitals via gateway

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  payout_number VARCHAR(30) UNIQUE,

  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
  payout_account_id UUID NOT NULL REFERENCES payout_accounts(id) ON DELETE RESTRICT,

  amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_payout_amount CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'INR',

  payout_mode payout_mode NOT NULL DEFAULT 'neft',

  -- Gateway
  gateway_provider VARCHAR(50) NOT NULL,
  gateway_payout_id VARCHAR(100),
  gateway_response JSONB,

  -- Status
  status payout_status NOT NULL DEFAULT 'pending',
  status_reason TEXT,

  -- UTR
  utr_number VARCHAR(50),

  -- Timestamps
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,

  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payouts_settlement ON payouts(settlement_id);
CREATE INDEX idx_payouts_account ON payouts(payout_account_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_gateway ON payouts(gateway_payout_id) WHERE gateway_payout_id IS NOT NULL;
CREATE INDEX idx_payouts_date ON payouts(created_at DESC);

-- ======================== PAYOUT ITEMS ========================

CREATE TABLE payout_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE RESTRICT,

  settlement_line_item_id UUID NOT NULL REFERENCES settlement_line_items(id) ON DELETE RESTRICT,

  amount DECIMAL(12,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_items_payout ON payout_items(payout_id);

-- ======================== FINANCIAL LEDGER ========================
-- Double-entry bookkeeping — append-only, immutable

CREATE TABLE financial_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  reference_type VARCHAR(50) NOT NULL,  -- payment, refund, payout, settlement, hold
  reference_id UUID NOT NULL,

  -- Double-entry
  entry_type ledger_entry_type NOT NULL,
  account_type ledger_account_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),

  -- Running balance per account_type (maintained by trigger)
  running_balance DECIMAL(14,2) NOT NULL DEFAULT 0,

  description TEXT,
  metadata JSONB,

  -- Immutability
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- No updated_at — ledger entries are immutable
);

CREATE INDEX idx_ledger_reference ON financial_ledger(reference_type, reference_id);
CREATE INDEX idx_ledger_account ON financial_ledger(account_type, created_at);
CREATE INDEX idx_ledger_date ON financial_ledger(created_at DESC);
CREATE INDEX idx_ledger_entry_type ON financial_ledger(entry_type, account_type);

-- ======================== HOLD FUNDS ========================
-- Temporary holds on settlement amounts (disputes, pending verifications)

CREATE TABLE hold_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What is held
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  -- Trigger
  reason VARCHAR(100) NOT NULL,          -- dispute, verification, compliance
  related_payment_id UUID REFERENCES payments(id),
  related_dispute_id UUID REFERENCES payment_disputes(id),

  amount DECIMAL(12,2) NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES users(id) ON DELETE SET NULL,
  release_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hold_funds_entity ON hold_funds(entity_type, entity_id);
CREATE INDEX idx_hold_funds_active ON hold_funds(is_active) WHERE is_active = true;
CREATE INDEX idx_hold_funds_payment ON hold_funds(related_payment_id) WHERE related_payment_id IS NOT NULL;
CREATE INDEX idx_hold_funds_dispute ON hold_funds(related_dispute_id) WHERE related_dispute_id IS NOT NULL;

-- ======================== RECONCILIATION RECORDS ========================

CREATE TABLE reconciliation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Period
  reconciliation_date DATE NOT NULL,

  -- Gateway data
  gateway_provider VARCHAR(50) NOT NULL,
  gateway_transaction_id VARCHAR(100) NOT NULL,
  gateway_amount DECIMAL(12,2) NOT NULL,
  gateway_status VARCHAR(50),

  -- Internal data
  internal_payment_id UUID REFERENCES payments(id),
  internal_amount DECIMAL(12,2),

  -- Result
  status reconciliation_status NOT NULL DEFAULT 'pending',
  discrepancy_amount DECIMAL(12,2) DEFAULT 0,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recon_date ON reconciliation_records(reconciliation_date);
CREATE INDEX idx_recon_status ON reconciliation_records(status);
CREATE INDEX idx_recon_gateway ON reconciliation_records(gateway_provider, gateway_transaction_id);
CREATE INDEX idx_recon_payment ON reconciliation_records(internal_payment_id) WHERE internal_payment_id IS NOT NULL;

-- ======================== COMMISSION SLABS ========================

CREATE TABLE commission_slabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Slab range
  min_monthly_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_monthly_revenue DECIMAL(14,2),  -- NULL = unlimited

  -- Rates
  consultation_commission_percent DECIMAL(5,2) NOT NULL,
  medicine_commission_percent DECIMAL(5,2) NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_slabs_active ON commission_slabs(is_active) WHERE is_active = true;

-- ======================== DAILY SETTLEMENT SUMMARY ========================

CREATE TABLE daily_settlement_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  summary_date DATE NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  total_payments INTEGER DEFAULT 0,
  total_payment_amount DECIMAL(14,2) DEFAULT 0,
  total_refunds INTEGER DEFAULT 0,
  total_refund_amount DECIMAL(14,2) DEFAULT 0,
  total_commission DECIMAL(14,2) DEFAULT 0,
  net_payable DECIMAL(14,2) DEFAULT 0,

  is_settled BOOLEAN DEFAULT false,
  settlement_id UUID REFERENCES settlements(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(summary_date, entity_type, entity_id)
);

CREATE INDEX idx_daily_summary_date ON daily_settlement_summary(summary_date);
CREATE INDEX idx_daily_summary_entity ON daily_settlement_summary(entity_type, entity_id);
CREATE INDEX idx_daily_summary_unsettled ON daily_settlement_summary(is_settled) WHERE is_settled = false;

-- ======================== SETTLEMENT INVOICES ========================

CREATE TABLE settlement_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,

  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,

  -- Amounts (mirror settlement)
  gross_amount DECIMAL(12,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  tds_amount DECIMAL(12,2) DEFAULT 0,
  net_payable DECIMAL(12,2) NOT NULL,

  -- GST on commission
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  igst_amount DECIMAL(12,2) DEFAULT 0,

  pdf_url TEXT,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_invoices_settlement ON settlement_invoices(settlement_id);
CREATE INDEX idx_settlement_invoices_date ON settlement_invoices(invoice_date);

-- ======================== PLATFORM CONFIG ========================

CREATE TABLE platform_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,

  config_type VARCHAR(50) DEFAULT 'general',

  updated_by UUID REFERENCES users(id),
  previous_value JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_config (config_key, config_value, config_type, description) VALUES
  ('consultation_commission_percent', '8',   'commission', 'Platform commission on consultation fees'),
  ('medicine_commission_percent',     '5',   'commission', 'Platform commission on medicine orders'),
  ('cancellation_policy', '{"free_hours":4,"partial_after_hours":24,"partial_percent":50}', 'policy', 'Cancellation and refund policy'),
  ('gst_rate',        '18',    'tax', 'GST rate for platform services'),
  ('tds_threshold',   '50000', 'tax', 'TDS deduction threshold for settlements'),
  ('tds_rate',        '2',     'tax', 'TDS rate for settlements above threshold'),
  ('min_payout_amount','500',  'payout', 'Minimum amount for initiating payout'),
  ('settlement_cycle_days', '7', 'payout', 'Default settlement cycle in days')
ON CONFLICT (config_key) DO NOTHING;

-- ======================== CANCELLATION POLICIES ========================

CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name VARCHAR(100) NOT NULL,
  description TEXT,

  free_cancellation_hours INTEGER DEFAULT 24,
  partial_refund_hours INTEGER DEFAULT 4,
  partial_refund_percent INTEGER DEFAULT 50,

  cancellation_fee_fixed DECIMAL(10,2) DEFAULT 0,
  cancellation_fee_percent DECIMAL(5,2) DEFAULT 0,

  applies_to_online BOOLEAN DEFAULT true,
  applies_to_in_person BOOLEAN DEFAULT true,
  applies_to_walk_in BOOLEAN DEFAULT false,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cancellation_policies (name, description, is_default) VALUES
  ('Standard Policy', 'Free cancellation 24h before, 50% refund within 24h, no refund within 4h', true)
ON CONFLICT DO NOTHING;

-- ======================== FORWARD FK: Appointments → Settlements ========================

ALTER TABLE appointments ADD COLUMN settlement_id UUID REFERENCES settlements(id);
CREATE INDEX idx_appointments_settlement ON appointments(settlement_id) WHERE settlement_id IS NOT NULL;

-- ======================== PERFORMANCE INDEXES (I9) ========================

-- settlement_line_items.transaction_id — joined during settlement processing
CREATE INDEX IF NOT EXISTS idx_settlement_line_items_transaction_id
  ON settlement_line_items (transaction_id);
