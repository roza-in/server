-- ============================================================
-- ROZX Healthcare Platform - Migration 007
-- Notifications, Support & Audit (Supabase Ready)
-- ============================================================

-- ============================================================
-- NOTIFICATION TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  code VARCHAR(50) UNIQUE NOT NULL,
  type notification_type NOT NULL,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  
  -- Channel-specific templates
  sms_template TEXT,
  whatsapp_template TEXT,
  email_subject TEXT,
  email_body TEXT,
  push_title TEXT,
  push_body TEXT,
  
  -- Variables (for substitution)
  variables TEXT[],  -- ['patient_name', 'doctor_name', 'appointment_time']
  
  -- Channels enabled
  channels notification_channel[] DEFAULT ARRAY['push'::notification_channel, 'in_app'::notification_channel],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Recipient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Type
  type notification_type NOT NULL,
  template_id UUID REFERENCES notification_templates(id),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,  -- Additional structured data
  
  -- Deep link
  action_url TEXT,
  action_type VARCHAR(50),
  
  -- Related entities
  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Channel
  channel notification_channel NOT NULL DEFAULT 'in_app',
  
  -- Status
  status notification_status NOT NULL DEFAULT 'pending',
  
  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- External tracking
  external_id VARCHAR(100),  -- SMS/Email provider ID
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  
  -- Type preferences (what to receive)
  appointment_reminders BOOLEAN DEFAULT true,
  payment_updates BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  promotional BOOLEAN DEFAULT false,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_start TIME,
  quiet_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  ticket_number VARCHAR(20) UNIQUE,
  
  -- Requester
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Category & Priority
  category ticket_category NOT NULL,
  priority ticket_priority NOT NULL DEFAULT 'medium',
  
  -- Issue
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Related entities
  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Attachments
  attachments TEXT[],
  
  -- Status
  status ticket_status NOT NULL DEFAULT 'open',
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  
  -- Customer satisfaction
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback TEXT,
  
  -- SLA
  first_response_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_category ON support_tickets(category);
CREATE INDEX idx_tickets_priority ON support_tickets(priority, status);
CREATE INDEX idx_tickets_assigned ON support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_number ON support_tickets(ticket_number);

-- ============================================================
-- TICKET MESSAGES (Thread)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role user_role NOT NULL,
  
  -- Content
  message TEXT NOT NULL,
  attachments TEXT[],
  
  -- Internal note (not visible to customer)
  is_internal BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created ON ticket_messages(ticket_id, created_at);

-- ============================================================
-- AUDIT LOGS (Compliance & Security)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  user_id UUID REFERENCES users(id),
  user_role user_role,
  
  -- Action
  action audit_action NOT NULL,
  description TEXT,
  
  -- Target
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  correlation_id VARCHAR(50),
  
  -- Changes
  changes JSONB,  -- { before: {}, after: {} }
  
  -- Metadata
  metadata JSONB,
  
  -- PHI access tracking (DPDP compliance)
  accessed_phi BOOLEAN DEFAULT false,
  phi_fields TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_phi ON audit_logs(accessed_phi, created_at) WHERE accessed_phi = true;

-- ============================================================
-- SYSTEM LOGS (Application logs - optional)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  level VARCHAR(20) NOT NULL,  -- debug, info, warn, error, fatal
  message TEXT NOT NULL,
  
  -- Context
  module VARCHAR(50),
  function_name VARCHAR(100),
  
  -- Request
  request_id VARCHAR(50),
  correlation_id VARCHAR(50),
  
  -- Error details
  error_code VARCHAR(50),
  error_stack TEXT,
  
  -- Metadata
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioning for efficient querying (if using partitioning)
-- Note: Supabase supports partitioning but may require manual setup
CREATE INDEX idx_system_logs_level ON system_logs(level, created_at);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX idx_system_logs_module ON system_logs(module, created_at);

-- ============================================================
-- API KEYS (For integrations)
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Key
  key_prefix VARCHAR(10) NOT NULL,  -- First chars for identification
  key_hash TEXT NOT NULL,           -- Hashed full key
  
  -- Metadata
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Scopes
  scopes TEXT[] DEFAULT ARRAY['read'],  -- read, write, admin
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,
  
  -- Limits
  rate_limit_per_minute INTEGER DEFAULT 60,
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  -- Status
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

-- ============================================================
-- SCHEDULED NOTIFICATIONS (Future reminders)
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Target
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification details
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  
  -- Related entities
  appointment_id UUID REFERENCES appointments(id),
  medicine_order_id UUID REFERENCES medicine_orders(id),
  medication_reminder_id UUID REFERENCES medication_reminders(id),
  
  -- Schedule
  scheduled_for TIMESTAMPTZ NOT NULL,
  
  -- Channels
  channels notification_channel[] DEFAULT ARRAY['push'::notification_channel],
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, sent, cancelled
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_notifications_user ON scheduled_notifications(user_id);
CREATE INDEX idx_scheduled_notifications_schedule ON scheduled_notifications(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_scheduled_notifications_appointment ON scheduled_notifications(appointment_id) WHERE appointment_id IS NOT NULL;

-- ============================================================
-- INSERT DEFAULT NOTIFICATION TEMPLATES
-- ============================================================

INSERT INTO notification_templates (code, type, title, body, sms_template, push_body, variables, channels) VALUES
  ('appointment_booked', 'appointment_booked', 
   'Appointment Confirmed', 
   'Your appointment with Dr. {{doctor_name}} is confirmed for {{appointment_time}}',
   'ROZX: Appointment confirmed with Dr. {{doctor_name}} on {{appointment_date}} at {{appointment_time}}. Appointment ID: {{appointment_number}}',
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
