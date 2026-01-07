-- ============================================================
-- ROZX Healthcare Platform - Migration 007
-- Auth & Security: OTP, Sessions, Audit Logs, Support
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- OTP CODES TABLE
-- WhatsApp/SMS OTP for authentication
-- ============================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Target
  phone VARCHAR(15),
  email VARCHAR(255),
  
  -- OTP Details
  otp VARCHAR(6) NOT NULL,
  purpose otp_purpose NOT NULL DEFAULT 'login',
  channel otp_channel NOT NULL DEFAULT 'whatsapp',
  
  -- Validation
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  -- Expiry (default 10 minutes)
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- WhatsApp Specific
  whatsapp_message_id VARCHAR(255),
  whatsapp_status VARCHAR(50),                    -- sent, delivered, read, failed
  
  -- IP & Device
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP indexes
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_codes(purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON otp_codes(verified);
CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_codes(created_at DESC);

-- Auto-delete expired OTPs (handled by cron job or trigger)

-- ============================================================
-- USER SESSIONS TABLE
-- JWT refresh tokens and session management
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tokens
  refresh_token TEXT NOT NULL UNIQUE,
  access_token_hash VARCHAR(255),                 -- Hash of access token for validation
  
  -- Session Info
  device_info JSONB,
  -- Structure: { device_type, device_name, os, browser, app_version }
  
  -- Network Info
  ip_address VARCHAR(45),
  user_agent TEXT,
  location JSONB,                                 -- Geo-location if available
  
  -- Session State
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON user_sessions(last_active_at DESC);

-- ============================================================
-- AUDIT LOGS TABLE
-- Comprehensive activity logging for compliance
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role user_role,
  
  -- Action
  action audit_action NOT NULL,
  action_description TEXT,
  
  -- Target
  entity_type VARCHAR(100) NOT NULL,              -- users, appointments, payments, etc.
  entity_id UUID,
  
  -- Data Changes
  old_data JSONB,
  new_data JSONB,
  changes JSONB,                                  -- Just the changed fields
  
  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),                        -- For request tracing
  
  -- Additional Info
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Partition audit_logs by month for better performance (optional)
-- CREATE INDEX IF NOT EXISTS idx_audit_created_month ON audit_logs(created_at);

-- ============================================================
-- LOGIN HISTORY TABLE
-- Track all login attempts
-- ============================================================

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User (null if failed login with unknown user)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Login Details
  login_method VARCHAR(50) NOT NULL,              -- password, otp, google
  login_identifier VARCHAR(255),                  -- email/phone used
  
  -- Result
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(100),
  
  -- Device & Network
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSONB,
  location JSONB,
  
  -- Risk Assessment
  risk_score DECIMAL(3,2),                        -- 0-1 risk score
  is_suspicious BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login history indexes
CREATE INDEX IF NOT EXISTS idx_login_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_identifier ON login_history(login_identifier);
CREATE INDEX IF NOT EXISTS idx_login_success ON login_history(success);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_history(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_created ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_suspicious ON login_history(is_suspicious) WHERE is_suspicious = true;

-- ============================================================
-- PASSWORD RESET TOKENS TABLE
-- Secure password reset
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token
  token VARCHAR(255) NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL,
  
  -- Expiry (1 hour)
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Usage
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  
  -- IP & Device
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Password reset indexes
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at);

-- ============================================================
-- API KEYS TABLE
-- For hospital integrations
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Key Details
  key_hash VARCHAR(255) NOT NULL,                 -- Hashed API key
  key_prefix VARCHAR(10) NOT NULL,                -- First 8 chars for identification
  name VARCHAR(100) NOT NULL,
  
  -- Permissions
  scopes TEXT[],                                  -- read, write, appointments, payments
  
  -- Rate Limits
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Usage
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  total_requests INTEGER DEFAULT 0,
  
  -- Expiry
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hospital ON api_keys(hospital_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- ============================================================
-- SUPPORT TICKETS TABLE
-- Customer support tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ticket Number
  ticket_number VARCHAR(20) NOT NULL UNIQUE,      -- ROZX-SUPPORT-XXXXX
  
  -- Reporter
  user_id UUID REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Contact
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(15),
  
  -- Ticket Details
  category VARCHAR(50) NOT NULL,                  -- payment, booking, technical, other
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Priority
  priority VARCHAR(20) DEFAULT 'medium',          -- low, medium, high, urgent
  
  -- Status
  status VARCHAR(20) DEFAULT 'open',              -- open, in_progress, waiting, resolved, closed
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,
  
  -- Related Entities
  appointment_id UUID REFERENCES appointments(id),
  payment_id UUID REFERENCES payments(id),
  
  -- Attachments
  attachments TEXT[],
  
  -- Resolution
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  
  -- Customer Satisfaction
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support ticket indexes
CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_hospital ON support_tickets(hospital_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);

-- ============================================================
-- SUPPORT TICKET MESSAGES TABLE
-- Thread of messages on ticket
-- ============================================================

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  
  -- Sender
  user_id UUID REFERENCES users(id),
  is_staff BOOLEAN DEFAULT false,
  sender_name VARCHAR(255),
  
  -- Message
  message TEXT NOT NULL,
  
  -- Attachments
  attachments TEXT[],
  
  -- Internal Note (not visible to customer)
  is_internal BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket message indexes
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_user ON support_ticket_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON support_ticket_messages(created_at);

-- ============================================================
-- SYSTEM SETTINGS TABLE
-- Platform-wide settings
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Setting
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  
  -- Description
  description TEXT,
  
  -- Type
  data_type VARCHAR(20) DEFAULT 'string',         -- string, number, boolean, json
  
  -- Audit
  updated_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description, data_type) VALUES
  ('platform_fee_online', '"7.00"', 'Platform fee percentage for online consultations', 'number'),
  ('platform_fee_in_person', '"4.00"', 'Platform fee percentage for in-person consultations', 'number'),
  ('platform_fee_walk_in', '"2.00"', 'Platform fee percentage for walk-in appointments', 'number'),
  ('gst_percentage', '"18.00"', 'GST percentage', 'number'),
  ('payment_timeout_minutes', '"15"', 'Minutes before unpaid appointment is auto-cancelled', 'number'),
  ('refund_full_hours', '"24"', 'Hours before appointment for full refund', 'number'),
  ('refund_partial_75_hours', '"12"', 'Hours before appointment for 75% refund', 'number'),
  ('otp_expiry_minutes', '"10"', 'OTP validity in minutes', 'number'),
  ('otp_max_attempts', '"3"', 'Maximum OTP verification attempts', 'number'),
  ('session_expiry_days', '"7"', 'Refresh token validity in days', 'number'),
  ('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean'),
  ('new_registrations_enabled', 'true', 'Allow new user registrations', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- Setting indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(key);

-- ============================================================
-- END OF MIGRATION 007
-- ============================================================
