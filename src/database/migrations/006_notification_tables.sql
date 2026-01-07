-- ============================================================
-- ROZX Healthcare Platform - Migration 006
-- Notification System: Notifications, Preferences, Templates, Scheduled
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- NOTIFICATION TEMPLATES TABLE
-- WhatsApp/SMS/Email templates
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Template Details
  name VARCHAR(100) NOT NULL UNIQUE,              -- Internal name
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  
  -- Content
  title_template VARCHAR(255),                    -- For push/email
  body_template TEXT NOT NULL,                    -- Main message
  
  -- WhatsApp Specific
  whatsapp_template_name VARCHAR(100),            -- Meta-approved template name
  whatsapp_template_language VARCHAR(10) DEFAULT 'en',
  
  -- Variables
  variables TEXT[],                               -- Available variables: {{patient_name}}, etc.
  
  -- Active
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template indexes
CREATE INDEX IF NOT EXISTS idx_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_templates_name ON notification_templates(name);

-- Insert default templates
INSERT INTO notification_templates (name, type, channel, title_template, body_template, variables) VALUES
  -- Appointment Booking Confirmation
  ('appointment_booked_whatsapp', 'appointment_booked', 'whatsapp',
   NULL,
   'Your appointment with {{doctor_name}} at {{hospital_name}} is confirmed for {{date}} at {{time}}. Booking ID: {{booking_id}}. Join: {{link}}',
   ARRAY['doctor_name', 'hospital_name', 'date', 'time', 'booking_id', 'link']),
  
  ('appointment_booked_sms', 'appointment_booked', 'sms',
   NULL,
   'ROZX: Appointment confirmed with {{doctor_name}} on {{date}} {{time}}. ID: {{booking_id}}',
   ARRAY['doctor_name', 'date', 'time', 'booking_id']),
  
  -- Reminder Templates
  ('reminder_24h_whatsapp', 'appointment_reminder_24h', 'whatsapp',
   NULL,
   'Reminder: Your appointment with {{doctor_name}} is tomorrow at {{time}}. Join: {{link}}. To reschedule: {{reschedule_link}}',
   ARRAY['doctor_name', 'time', 'link', 'reschedule_link']),
  
  ('reminder_1h_whatsapp', 'appointment_reminder_1h', 'whatsapp',
   NULL,
   'Your appointment starts in 1 hour! Dr. {{doctor_name}} at {{time}}. Join now: {{link}}',
   ARRAY['doctor_name', 'time', 'link']),
  
  -- Payment Templates
  ('payment_success_whatsapp', 'payment_success', 'whatsapp',
   NULL,
   'Payment of {{amount}} received for appointment with {{doctor_name}}. Receipt: {{receipt_link}}',
   ARRAY['amount', 'doctor_name', 'receipt_link']),
  
  -- Prescription Templates
  ('prescription_ready_whatsapp', 'prescription_ready', 'whatsapp',
   NULL,
   '{{doctor_name}} has shared your prescription. View: {{link}} | Download PDF: {{pdf_link}}',
   ARRAY['doctor_name', 'link', 'pdf_link']),
  
  -- Welcome
  ('welcome_whatsapp', 'welcome', 'whatsapp',
   NULL,
   'Welcome to ROZX! Book appointments with trusted hospitals. Get started: {{link}}',
   ARRAY['link'])
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- NOTIFICATIONS TABLE
-- All notifications sent to users
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Recipient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Details
  type notification_type NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  
  -- Content
  title VARCHAR(255),
  message TEXT NOT NULL,
  
  -- Template Used
  template_id UUID REFERENCES notification_templates(id),
  template_variables JSONB,
  
  -- Related Entities
  appointment_id UUID REFERENCES appointments(id),
  payment_id UUID REFERENCES payments(id),
  prescription_id UUID REFERENCES prescriptions(id),
  
  -- Action
  action_url TEXT,                                -- Deep link
  action_type VARCHAR(50),                        -- view_appointment, join_consultation
  
  -- Additional Data
  data JSONB,
  
  -- Status
  status notification_status NOT NULL DEFAULT 'pending',
  
  -- Delivery Tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- External IDs
  external_message_id VARCHAR(255),               -- WhatsApp/SMS message ID
  
  -- Retry
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_appointment ON notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications(next_retry_at) WHERE status = 'failed' AND retry_count < 3;

-- ============================================================
-- NOTIFICATION PREFERENCES TABLE
-- User preferences for notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Channel Preferences
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  
  -- Type Preferences
  appointment_reminders BOOLEAN DEFAULT true,
  payment_alerts BOOLEAN DEFAULT true,
  prescription_notifications BOOLEAN DEFAULT true,
  follow_up_reminders BOOLEAN DEFAULT true,
  promotional_messages BOOLEAN DEFAULT false,
  health_tips BOOLEAN DEFAULT true,
  
  -- Quiet Hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preference indexes
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================================
-- DEVICE TOKENS TABLE
-- Push notification tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token
  token TEXT NOT NULL,
  
  -- Device Info
  platform VARCHAR(20) NOT NULL,                  -- ios, android, web
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  app_version VARCHAR(20),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, token)
);

-- Device token indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- ============================================================
-- SCHEDULED NOTIFICATIONS TABLE
-- Pre-scheduled notifications (reminders)
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Recipient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Schedule
  scheduled_at TIMESTAMPTZ NOT NULL,
  
  -- Notification Details
  type notification_type NOT NULL,
  channels notification_channel[] NOT NULL,
  
  -- Template
  template_id UUID REFERENCES notification_templates(id),
  template_variables JSONB,
  
  -- Related Entities
  appointment_id UUID REFERENCES appointments(id),
  
  -- Custom Content (if no template)
  title VARCHAR(255),
  message TEXT,
  action_url TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',           -- pending, sent, cancelled, failed
  
  -- Execution
  executed_at TIMESTAMPTZ,
  notification_ids UUID[],                        -- Created notification IDs
  
  -- Error
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled notification indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_appointment ON scheduled_notifications(appointment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_pending ON scheduled_notifications(scheduled_at) 
  WHERE status = 'pending';

-- ============================================================
-- HOSPITAL ANNOUNCEMENTS TABLE
-- Announcements from hospitals to patients
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Hospital
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Announcement
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Target Audience
  target_all_patients BOOLEAN DEFAULT true,
  target_patient_ids UUID[],                      -- Specific patients
  
  -- Channels
  channels notification_channel[] DEFAULT ARRAY['in_app']::notification_channel[],
  
  -- Schedule
  publish_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',             -- draft, published, archived
  
  -- Metrics
  sent_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  
  -- Created By
  created_by UUID NOT NULL REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcement indexes
CREATE INDEX IF NOT EXISTS idx_announcements_hospital ON hospital_announcements(hospital_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON hospital_announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_publish ON hospital_announcements(publish_at);

-- ============================================================
-- END OF MIGRATION 006
-- ============================================================
