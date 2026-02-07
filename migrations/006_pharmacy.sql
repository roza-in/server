-- ============================================================
-- ROZX Healthcare Platform - Migration 006
-- ROZX Central Pharmacy (Supabase Ready)
-- ============================================================
-- 
-- KEY DESIGN: ONE centralized ROZX pharmacy, NOT multi-pharmacy
-- - ROZX pharmacy team manages catalog & pricing
-- - Hospital commission on medicines set by ROZX Pharmacy
-- - Platform commission set by Admin
--
-- ============================================================

-- ============================================================
-- MEDICINES CATALOG (Managed by ROZX Pharmacy)
-- ============================================================

CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  brand VARCHAR(100),
  manufacturer VARCHAR(255),
  
  -- Classification
  category medicine_category NOT NULL DEFAULT 'tablet',
  schedule medicine_schedule NOT NULL DEFAULT 'otc',
  
  -- Drug information
  composition TEXT,  -- Active ingredients
  strength VARCHAR(100),  -- e.g., "500mg", "10ml"
  pack_size VARCHAR(50),  -- e.g., "Strip of 10", "Bottle of 100ml"
  
  -- Pricing (Set by ROZX Pharmacy)
  mrp DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Hospital commission (Set by ROZX Pharmacy) 
  hospital_commission_percent DECIMAL(5,2) DEFAULT 10,
  
  -- Prescription
  is_prescription_required BOOLEAN DEFAULT false,
  
  -- Stock
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  is_in_stock BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_discontinued BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  usage_instructions TEXT,
  side_effects TEXT,
  contraindications TEXT,
  storage_instructions TEXT,
  
  -- Images
  image_url TEXT,
  images TEXT[],
  
  -- GST
  hsn_code VARCHAR(20),
  gst_percent DECIMAL(5,2) DEFAULT 12,
  
  -- Search optimization
  search_keywords TEXT[],
  
  -- Search vector (updated by trigger in 008_functions_triggers.sql)
  search_vector TSVECTOR,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_medicines_sku ON medicines(sku);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_schedule ON medicines(schedule);
CREATE INDEX idx_medicines_active ON medicines(is_active, is_in_stock);
CREATE INDEX idx_medicines_prescription ON medicines(is_prescription_required);

-- Full text search (using generated column)
CREATE INDEX idx_medicines_search ON medicines USING GIN(search_vector);

-- ============================================================
-- MEDICINE ORDERS (Patient orders from ROZX Pharmacy)
-- ============================================================

CREATE TABLE IF NOT EXISTS medicine_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  order_number VARCHAR(30) UNIQUE,
  
  -- Related prescription
  prescription_id UUID REFERENCES prescriptions(id),
  
  -- Patient
  patient_id UUID NOT NULL REFERENCES users(id),
  family_member_id UUID REFERENCES family_members(id),
  
  -- Hospital reference (for commission)
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Delivery address
  delivery_address JSONB NOT NULL,
  -- { address, city, state, pincode, landmark, phone, lat, lng }
  
  -- Status
  status medicine_order_status NOT NULL DEFAULT 'pending',
  status_history JSONB DEFAULT '[]',
  
  -- Amounts
  items_total DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  delivery_fee DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  
  -- Commission (Set by ROZX Pharmacy)
  hospital_commission DECIMAL(12,2) DEFAULT 0,
  platform_commission DECIMAL(12,2) DEFAULT 0,
  
  -- Prescription verification (by ROZX Pharmacy)
  requires_prescription BOOLEAN DEFAULT false,
  prescription_verified BOOLEAN DEFAULT false,
  prescription_verified_by UUID REFERENCES users(id),
  prescription_verified_at TIMESTAMPTZ,
  prescription_rejection_reason TEXT,
  
  -- Delivery partner
  delivery_partner delivery_partner_code,
  delivery_tracking_id VARCHAR(100),
  delivery_tracking_url TEXT,
  estimated_delivery_at TIMESTAMPTZ,
  
  -- Delivery OTP
  delivery_otp VARCHAR(6),
  
  -- Timestamps
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Cancellation
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
  
  -- Payment
  payment_status payment_status DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),
  
  -- Notes
  patient_notes TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_medicine_orders_patient ON medicine_orders(patient_id);
CREATE INDEX idx_medicine_orders_hospital ON medicine_orders(hospital_id);
CREATE INDEX idx_medicine_orders_prescription ON medicine_orders(prescription_id);
CREATE INDEX idx_medicine_orders_status ON medicine_orders(status);
CREATE INDEX idx_medicine_orders_number ON medicine_orders(order_number);
CREATE INDEX idx_medicine_orders_date ON medicine_orders(placed_at DESC);

-- ============================================================
-- MEDICINE ORDER ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS medicine_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id),
  
  -- From prescription (if applicable)
  prescription_item_index INTEGER,
  
  -- Quantity
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Pricing (at time of order)
  unit_mrp DECIMAL(10,2) NOT NULL,
  unit_selling_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,
  
  -- Medicine snapshot (in case medicine changes)
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

-- ============================================================
-- DELIVERY TRACKING EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  order_id UUID NOT NULL REFERENCES medicine_orders(id) ON DELETE CASCADE,
  
  -- Event
  status VARCHAR(50) NOT NULL,
  status_message TEXT,
  
  -- Location (if available)
  location JSONB,  -- { lat, lng, address }
  
  -- Source
  source VARCHAR(50) DEFAULT 'system',  -- system, delivery_partner
  external_status VARCHAR(100),
  
  event_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_tracking_order ON delivery_tracking(order_id);
CREATE INDEX idx_delivery_tracking_time ON delivery_tracking(order_id, event_time DESC);

-- ============================================================
-- MEDICINE RETURNS (Policy-based, handled by ROZX Pharmacy)
-- ============================================================

CREATE TABLE IF NOT EXISTS medicine_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  return_number VARCHAR(30) UNIQUE,
  
  order_id UUID NOT NULL REFERENCES medicine_orders(id),
  
  -- Reason
  reason VARCHAR(50) NOT NULL,
  reason_details TEXT,
  
  -- Items being returned
  items JSONB NOT NULL,
  -- [{ order_item_id, medicine_id, quantity, reason }]
  
  -- Photos
  photos TEXT[],
  
  -- Amounts
  refund_amount DECIMAL(12,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  -- Processing
  initiated_by UUID NOT NULL REFERENCES users(id),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Pickup
  pickup_scheduled_at TIMESTAMPTZ,
  pickup_completed_at TIMESTAMPTZ,
  
  -- Refund
  refund_id UUID REFERENCES refunds(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medicine_returns_order ON medicine_returns(order_id);
CREATE INDEX idx_medicine_returns_status ON medicine_returns(status);

-- ============================================================
-- PHARMACY SETTLEMENTS (ROZX to Hospital commission payments)
-- ============================================================

CREATE TABLE IF NOT EXISTS pharmacy_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  settlement_number VARCHAR(30) UNIQUE,
  
  -- Hospital receiving commission
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Order summary
  total_orders INTEGER DEFAULT 0,
  total_order_value DECIMAL(12,2) DEFAULT 0,
  
  -- Commission
  commission_rate DECIMAL(5,2) NOT NULL,
  gross_commission DECIMAL(12,2) NOT NULL,
  
  -- Deductions
  tds_amount DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  deduction_details JSONB,
  
  -- Net payable
  net_payable DECIMAL(12,2) NOT NULL,
  
  -- Status
  status settlement_status NOT NULL DEFAULT 'pending',
  
  -- Processing
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  
  -- Payment
  payment_mode VARCHAR(50),
  utr_number VARCHAR(50),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pharmacy_settlements_hospital ON pharmacy_settlements(hospital_id);
CREATE INDEX idx_pharmacy_settlements_status ON pharmacy_settlements(status);
CREATE INDEX idx_pharmacy_settlements_period ON pharmacy_settlements(period_start, period_end);

-- ============================================================
-- ADD FK TO PRESCRIPTIONS FOR ORDER TRACKING
-- ============================================================

-- Add FK from prescriptions to medicine_orders
ALTER TABLE prescriptions 
  ADD CONSTRAINT fk_prescriptions_medicine_order 
  FOREIGN KEY (medicine_order_id) 
  REFERENCES medicine_orders(id);

-- Add FK from payments to medicine_orders
ALTER TABLE payments 
  ADD CONSTRAINT fk_payments_medicine_order 
  FOREIGN KEY (medicine_order_id) 
  REFERENCES medicine_orders(id);
