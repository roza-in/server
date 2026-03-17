-- ============================================================
-- ROZX Healthcare Platform — Migration 008
-- Notifications, Support & Audit
-- ============================================================
-- Depends on: 007 (pharmacy)
-- ============================================================

-- ======================== NOTIFICATION TEMPLATES ========================

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  code VARCHAR(50) UNIQUE NOT NULL,
  type notification_type NOT NULL,

  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,

  sms_template TEXT,
  whatsapp_template TEXT,
  email_subject TEXT,
  email_body TEXT,
  push_title TEXT,
  push_body TEXT,

  variables TEXT[],

  channels notification_channel[] DEFAULT ARRAY['push'::notification_channel, 'in_app'::notification_channel],

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================== NOTIFICATIONS ========================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type notification_type NOT NULL,
  template_id UUID REFERENCES notification_templates(id),

  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,

  action_url TEXT,
  action_type VARCHAR(50),

  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  payment_id UUID REFERENCES payments(id),

  channel notification_channel NOT NULL DEFAULT 'in_app',

  status notification_status NOT NULL DEFAULT 'pending',

  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  external_id VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_appointment ON notifications(appointment_id) WHERE appointment_id IS NOT NULL;

-- ======================== NOTIFICATION PREFERENCES ========================

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,

  appointment_reminders BOOLEAN DEFAULT true,
  payment_updates BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  promotional BOOLEAN DEFAULT false,

  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_start TIME,
  quiet_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ======================== SUPPORT TICKETS ========================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  ticket_number VARCHAR(20) UNIQUE,

  user_id UUID NOT NULL REFERENCES users(id),

  category ticket_category NOT NULL,
  priority ticket_priority NOT NULL DEFAULT 'medium',

  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  payment_id UUID REFERENCES payments(id),

  attachments TEXT[],

  status ticket_status NOT NULL DEFAULT 'open',

  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,

  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback TEXT,

  first_response_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_category ON support_tickets(category);
CREATE INDEX idx_tickets_priority ON support_tickets(priority, status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_number ON support_tickets(ticket_number);

-- ======================== TICKET MESSAGES ========================

CREATE TABLE ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role user_role NOT NULL,

  message TEXT NOT NULL,
  attachments TEXT[],

  is_internal BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created ON ticket_messages(ticket_id, created_at);

-- ======================== AUDIT LOGS ========================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID REFERENCES users(id),
  user_role user_role,

  action audit_action NOT NULL,
  description TEXT,

  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,

  ip_address INET,
  user_agent TEXT,
  correlation_id VARCHAR(50),

  changes JSONB,
  metadata JSONB,

  -- DPDP compliance
  accessed_phi BOOLEAN DEFAULT false,
  phi_fields TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_phi_created ON audit_logs(accessed_phi, created_at DESC) WHERE accessed_phi = true;

-- ======================== SYSTEM LOGS ========================

CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,

  module VARCHAR(50),
  function_name VARCHAR(100),

  request_id VARCHAR(50),
  correlation_id VARCHAR(50),

  error_code VARCHAR(50),
  error_stack TEXT,

  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level, created_at);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_module ON system_logs(module, created_at);

-- ======================== API KEYS ========================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,

  key_prefix VARCHAR(10) NOT NULL,
  key_hash TEXT NOT NULL,

  name VARCHAR(100) NOT NULL,
  description TEXT,

  scopes TEXT[] DEFAULT ARRAY['read'],

  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,

  rate_limit_per_minute INTEGER DEFAULT 60,

  expires_at TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_api_keys_hospital ON api_keys(hospital_id) WHERE hospital_id IS NOT NULL;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ======================== SCHEDULED NOTIFICATIONS ========================

CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,

  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  medication_reminder_id UUID REFERENCES medication_reminders(id),

  scheduled_for TIMESTAMPTZ NOT NULL,

  channels notification_channel[] DEFAULT ARRAY['push'::notification_channel],

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_notif_user ON scheduled_notifications(user_id);
CREATE INDEX idx_scheduled_notif_schedule ON scheduled_notifications(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_scheduled_notif_appointment ON scheduled_notifications(appointment_id) WHERE appointment_id IS NOT NULL;

-- ======================== SEED NOTIFICATION TEMPLATES ========================

INSERT INTO notification_templates (code, type, title, body, sms_template, push_body, variables, channels) VALUES
  ('appointment_booked', 'appointment_booked',
   'Appointment Confirmed',
   'Your appointment with Dr. {{doctor_name}} is confirmed for {{appointment_time}}',
   'ROZX: Appointment confirmed with Dr. {{doctor_name}} on {{appointment_date}} at {{appointment_time}}. ID: {{appointment_number}}',
   'Appointment confirmed with Dr. {{doctor_name}}',
   ARRAY['doctor_name', 'appointment_date', 'appointment_time', 'appointment_number'],
   ARRAY['sms'::notification_channel, 'push'::notification_channel, 'in_app'::notification_channel]),

  ('appointment_reminder_24h', 'appointment_reminder_24h',
   'Appointment Tomorrow',
   'Reminder: Your appointment with Dr. {{doctor_name}} is tomorrow at {{appointment_time}}',
   'ROZX Reminder: Appointment with Dr. {{doctor_name}} tomorrow at {{appointment_time}}',
   'Appointment tomorrow at {{appointment_time}}',
   ARRAY['doctor_name', 'appointment_time'],
   ARRAY['sms'::notification_channel, 'push'::notification_channel]),

  ('payment_success', 'payment_success',
   'Payment Successful',
   'Payment of ₹{{amount}} received for {{payment_type}}',
   'ROZX: Payment of Rs.{{amount}} received. Transaction ID: {{payment_id}}',
   'Payment of ₹{{amount}} successful',
   ARRAY['amount', 'payment_type', 'payment_id'],
   ARRAY['sms'::notification_channel, 'push'::notification_channel, 'in_app'::notification_channel]),

  ('medicine_dispatched', 'medicine_dispatched',
   'Order Dispatched',
   'Your medicine order #{{order_number}} has been dispatched',
   'ROZX: Order #{{order_number}} dispatched. Track: {{tracking_url}}',
   'Order #{{order_number}} is on the way',
   ARRAY['order_number', 'tracking_url'],
   ARRAY['sms'::notification_channel, 'push'::notification_channel, 'in_app'::notification_channel]),

  ('medicine_delivered', 'medicine_delivered',
   'Order Delivered',
   'Your medicine order #{{order_number}} has been delivered',
   'ROZX: Order #{{order_number}} delivered. Thank you!',
   'Order delivered successfully',
   ARRAY['order_number'],
   ARRAY['sms'::notification_channel, 'push'::notification_channel, 'in_app'::notification_channel])
ON CONFLICT (code) DO NOTHING;

-- ======================== NOTIFICATION QUEUE ========================
-- Background job queue for processing notifications

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,

  channel notification_channel NOT NULL,
  recipient TEXT NOT NULL,           -- phone, email, device_token

  payload JSONB NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_notif_queue_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),

  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,

  priority INTEGER DEFAULT 5
    CONSTRAINT chk_notif_queue_priority CHECK (priority BETWEEN 1 AND 10),

  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_queue_status ON notification_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notif_queue_notification ON notification_queue(notification_id);
CREATE INDEX idx_notif_queue_retry ON notification_queue(next_attempt_at) WHERE status = 'failed' AND attempts < max_attempts;


-- ======================== SCHEDULED REPORTS ========================

CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,       -- revenue, appointments, settlements, analytics

  -- Scope
  entity_type VARCHAR(50),                -- hospital, platform
  entity_id UUID,

  -- Schedule
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly'
    CONSTRAINT chk_report_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,

  -- Recipients
  recipients TEXT[] NOT NULL,             -- email addresses
  created_by UUID NOT NULL REFERENCES users(id),

  -- Config
  report_config JSONB DEFAULT '{}',       -- filters, columns, etc.
  output_format VARCHAR(10) DEFAULT 'pdf'
    CONSTRAINT chk_report_format CHECK (output_format IN ('pdf', 'csv', 'xlsx')),

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_report_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_next ON scheduled_reports(next_run_at, is_active) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_entity ON scheduled_reports(entity_type, entity_id);

-- ======================== HOSPITAL ANNOUNCEMENTS ========================

CREATE TABLE hospital_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general'
    CONSTRAINT chk_announcement_type CHECK (type IN ('general', 'holiday', 'schedule_change', 'emergency', 'offer')),

  -- Visibility
  is_public BOOLEAN DEFAULT false,        -- visible to patients
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Targeting
  target_roles user_role[] DEFAULT ARRAY['patient'::user_role],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_hospital ON hospital_announcements(hospital_id, is_active);
CREATE INDEX idx_announcements_active ON hospital_announcements(starts_at, expires_at) WHERE is_active = true;

-- ======================== RATING HELPFULNESS ========================

CREATE TABLE rating_helpfulness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_helpful BOOLEAN NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(rating_id, user_id)
);

CREATE INDEX idx_rating_helpfulness_rating ON rating_helpfulness(rating_id);

-- ======================== PATIENT CREDITS ========================

CREATE TABLE patient_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  balance DECIMAL(12,2) NOT NULL DEFAULT 0
    CONSTRAINT chk_credit_balance CHECK (balance >= 0),

  lifetime_earned DECIMAL(12,2) DEFAULT 0,
  lifetime_redeemed DECIMAL(12,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ======================== CREDIT TRANSACTIONS ========================

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  credit_account_id UUID NOT NULL REFERENCES patient_credits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  type VARCHAR(20) NOT NULL
    CONSTRAINT chk_credit_txn_type CHECK (type IN ('earn', 'redeem', 'expire', 'admin_adjust', 'refund')),

  amount DECIMAL(12,2) NOT NULL
    CONSTRAINT chk_credit_txn_amount CHECK (amount > 0),

  balance_after DECIMAL(12,2) NOT NULL,

  -- Reference
  reference_type VARCHAR(50),             -- appointment, medicine_order, referral, promotion
  reference_id UUID,

  description TEXT,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_txn_account ON credit_transactions(credit_account_id);
CREATE INDEX idx_credit_txn_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_txn_reference ON credit_transactions(reference_type, reference_id);

-- ======================== PATIENT MEDICATIONS ========================
-- Active medications tracked by health-records service

CREATE TABLE patient_medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),

  medication_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  route VARCHAR(50),                      -- oral, topical, injection, etc.

  prescribed_by UUID REFERENCES doctors(id),
  prescription_id UUID REFERENCES prescriptions(id),

  start_date DATE NOT NULL,
  end_date DATE,

  reason TEXT,
  notes TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_medications_patient ON patient_medications(patient_id);
CREATE INDEX idx_patient_medications_active ON patient_medications(patient_id, is_active) WHERE is_active = true;

-- ======================== PATIENT ALLERGIES ========================

CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),

  allergen VARCHAR(255) NOT NULL,
  allergen_type VARCHAR(50) NOT NULL DEFAULT 'drug'
    CONSTRAINT chk_allergen_type CHECK (allergen_type IN ('drug', 'food', 'environmental', 'insect', 'latex', 'other')),

  severity VARCHAR(20) DEFAULT 'moderate'
    CONSTRAINT chk_allergy_severity CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),

  reaction TEXT,
  onset_date DATE,
  diagnosed_by UUID REFERENCES doctors(id),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_allergies_patient ON patient_allergies(patient_id);
CREATE INDEX idx_patient_allergies_active ON patient_allergies(patient_id, is_active) WHERE is_active = true;

-- ======================== PATIENT MEDICAL CONDITIONS ========================

CREATE TABLE patient_medical_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),

  condition_name VARCHAR(255) NOT NULL,
  icd_code VARCHAR(20),                    -- ICD-10 code

  severity VARCHAR(20) DEFAULT 'moderate'
    CONSTRAINT chk_condition_severity CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),

  status VARCHAR(20) DEFAULT 'active'
    CONSTRAINT chk_condition_status CHECK (status IN ('active', 'resolved', 'chronic', 'in_remission')),

  diagnosed_date DATE,
  diagnosed_by UUID REFERENCES doctors(id),
  resolved_date DATE,

  notes TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_conditions_patient ON patient_medical_conditions(patient_id);
CREATE INDEX idx_patient_conditions_active ON patient_medical_conditions(patient_id, is_active) WHERE is_active = true;

-- ======================== PERFORMANCE INDEXES (I9) ========================

-- notification_queue(status, scheduled_for) — job picks up pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled
  ON notification_queue (status, scheduled_for)
  WHERE status IN ('pending', 'queued');
