-- ============================================================
-- ROZX Healthcare Platform — Migration 007
-- ROZX Central Pharmacy
-- ============================================================
-- Depends on: 005 (payments), 006 (settlements)
-- KEY: One centralized ROZX pharmacy — NOT multi-pharmacy
-- ============================================================

-- ======================== MEDICINES CATALOG ========================

CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand VARCHAR(100),
  manufacturer VARCHAR(255),

  category medicine_category NOT NULL DEFAULT 'tablet',
  schedule medicine_schedule NOT NULL DEFAULT 'otc',

  composition TEXT,
  strength VARCHAR(100),
  pack_size VARCHAR(50),

  -- Pricing
  mrp DECIMAL(10,2) NOT NULL
    CONSTRAINT chk_medicine_mrp CHECK (mrp > 0),
  selling_price DECIMAL(10,2) NOT NULL
    CONSTRAINT chk_medicine_selling_price CHECK (selling_price > 0),
  discount_percent DECIMAL(5,2) DEFAULT 0
    CONSTRAINT chk_medicine_discount CHECK (discount_percent BETWEEN 0 AND 100),

  -- Hospital commission (set by ROZX pharmacy)
  hospital_commission_percent DECIMAL(5,2) DEFAULT 10,

  is_prescription_required BOOLEAN DEFAULT false,

  -- Stock
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  is_in_stock BOOLEAN DEFAULT true,

  is_active BOOLEAN DEFAULT true,
  is_discontinued BOOLEAN DEFAULT false,

  -- Info
  description TEXT,
  usage_instructions TEXT,
  side_effects TEXT,
  contraindications TEXT,
  drug_interactions TEXT,                     -- SEO: Drug interaction info
  storage_instructions TEXT,

  -- SEO
  slug VARCHAR(255) UNIQUE,                   -- SEO: URL-friendly slug
  meta_title VARCHAR(70),                     -- SEO: Custom <title>
  meta_description VARCHAR(160),              -- SEO: Custom meta description

  image_url TEXT,
  images TEXT[],

  -- GST
  hsn_code VARCHAR(20),
  gst_percent DECIMAL(5,2) DEFAULT 12,

  search_keywords TEXT[],
  search_vector TSVECTOR,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicines_sku ON medicines(sku);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_schedule ON medicines(schedule);
CREATE INDEX idx_medicines_active ON medicines(is_active, is_in_stock);
CREATE INDEX idx_medicines_prescription ON medicines(is_prescription_required);
CREATE INDEX idx_medicines_search ON medicines USING GIN(search_vector);

-- ======================== MEDICINE ORDERS ========================

CREATE TABLE medicine_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  order_number VARCHAR(30) UNIQUE,

  prescription_id UUID REFERENCES prescriptions(id),

  patient_id UUID NOT NULL REFERENCES users(id),
  family_member_id UUID REFERENCES family_members(id),
  hospital_id UUID REFERENCES hospitals(id),

  delivery_address JSONB NOT NULL,

  -- Status
  status medicine_order_status NOT NULL DEFAULT 'pending',
  status_history JSONB DEFAULT '[]',

  -- Amounts
  items_total DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_order_items_total CHECK (items_total >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_order_discount CHECK (discount_amount >= 0),
  delivery_fee DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_order_delivery_fee CHECK (delivery_fee >= 0),
  gst_amount DECIMAL(12,2) DEFAULT 0
    CONSTRAINT chk_order_gst CHECK (gst_amount >= 0),
  total_amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_order_total_amount CHECK (total_amount > 0),

  -- Commission
  hospital_commission DECIMAL(12,2) DEFAULT 0,
  platform_commission DECIMAL(12,2) DEFAULT 0,

  -- Prescription verification
  requires_prescription BOOLEAN DEFAULT false,
  prescription_verified BOOLEAN DEFAULT false,
  prescription_verified_by UUID REFERENCES users(id),
  prescription_verified_at TIMESTAMPTZ,
  prescription_rejection_reason TEXT,

  -- Delivery
  delivery_partner delivery_partner_code,
  delivery_tracking_id VARCHAR(100),
  delivery_tracking_url TEXT,
  estimated_delivery_at TIMESTAMPTZ,
  delivery_otp VARCHAR(6),

  -- Timestamps
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,

  -- Payment
  payment_status payment_status DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),

  patient_notes TEXT,
  internal_notes TEXT,

  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicine_orders_patient ON medicine_orders(patient_id);
CREATE INDEX idx_medicine_orders_hospital ON medicine_orders(hospital_id);
CREATE INDEX idx_medicine_orders_prescription ON medicine_orders(prescription_id);
CREATE INDEX idx_medicine_orders_status ON medicine_orders(status);
CREATE INDEX idx_medicine_orders_number ON medicine_orders(order_number);
CREATE INDEX idx_medicine_orders_date ON medicine_orders(placed_at DESC);
CREATE INDEX idx_medicine_orders_payment ON medicine_orders(payment_id) WHERE payment_id IS NOT NULL;

-- ======================== MEDICINE ORDER ITEMS ========================

CREATE TABLE medicine_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id),

  prescription_item_index INTEGER,

  quantity INTEGER NOT NULL CHECK (quantity > 0),

  unit_mrp DECIMAL(10,2) NOT NULL,
  unit_selling_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,

  -- Snapshot
  medicine_name VARCHAR(255) NOT NULL,
  medicine_brand VARCHAR(100),
  medicine_strength VARCHAR(100),
  medicine_pack_size VARCHAR(50),
  requires_prescription BOOLEAN DEFAULT false,

  -- Substitution
  is_substitute BOOLEAN DEFAULT false,
  original_medicine_id UUID REFERENCES medicines(id),
  substitution_approved BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON medicine_order_items(order_id);
CREATE INDEX idx_order_items_medicine ON medicine_order_items(medicine_id);

-- ======================== DELIVERY TRACKING ========================

CREATE TABLE delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,

  status VARCHAR(50) NOT NULL,
  status_message TEXT,

  location JSONB,

  source VARCHAR(50) DEFAULT 'system',
  external_status VARCHAR(100),

  event_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_tracking_order ON delivery_tracking(order_id);
CREATE INDEX idx_delivery_tracking_time ON delivery_tracking(order_id, event_time DESC);

-- ======================== MEDICINE RETURNS ========================

CREATE TABLE medicine_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  return_number VARCHAR(30) UNIQUE,

  order_id UUID NOT NULL REFERENCES medicine_orders(id),

  reason VARCHAR(50) NOT NULL,
  reason_details TEXT,

  items JSONB NOT NULL,
  photos TEXT[],

  refund_amount DECIMAL(12,2) NOT NULL,

  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  initiated_by UUID NOT NULL REFERENCES users(id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),

  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  pickup_scheduled_at TIMESTAMPTZ,
  pickup_completed_at TIMESTAMPTZ,

  refund_id UUID REFERENCES refunds(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicine_returns_order ON medicine_returns(order_id);
CREATE INDEX idx_medicine_returns_status ON medicine_returns(status);

-- ======================== PHARMACY SETTLEMENTS ========================
-- Commission payments from ROZX pharmacy → hospitals

CREATE TABLE pharmacy_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  settlement_number VARCHAR(30) UNIQUE,

  hospital_id UUID NOT NULL REFERENCES hospitals(id),

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  total_orders INTEGER DEFAULT 0,
  total_order_value DECIMAL(12,2) DEFAULT 0,

  commission_rate DECIMAL(5,2) NOT NULL,
  gross_commission DECIMAL(12,2) NOT NULL,

  tds_amount DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  deduction_details JSONB,

  net_payable DECIMAL(12,2) NOT NULL,

  status settlement_status NOT NULL DEFAULT 'pending',

  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,

  payment_mode VARCHAR(50),
  utr_number VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pharmacy_settlements_hospital ON pharmacy_settlements(hospital_id);
CREATE INDEX idx_pharmacy_settlements_status ON pharmacy_settlements(status);
CREATE INDEX idx_pharmacy_settlements_period ON pharmacy_settlements(period_start, period_end);

-- ======================== CROSS-TABLE FK ADDITIONS ========================

ALTER TABLE prescriptions
  ADD CONSTRAINT fk_prescriptions_medicine_order
  FOREIGN KEY (medicine_order_id) REFERENCES medicine_orders(id);

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_medicine_order
  FOREIGN KEY (medicine_order_id) REFERENCES medicine_orders(id);

-- ======================== PERFORMANCE INDEXES (I9) ========================

-- medicine_orders.patient_id — patient order history lookups
CREATE INDEX IF NOT EXISTS idx_medicine_orders_patient_id
  ON medicine_orders (patient_id);
