-- ============================================================
-- ROZX Healthcare Platform - Migration 002
-- Users & Authentication (Supabase Ready)
-- ============================================================

-- ============================================================
-- USERS TABLE (Central for all roles)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Auth
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(15) UNIQUE,
  password_hash TEXT,
  
  -- Role
  role user_role NOT NULL DEFAULT 'patient',
  
  -- Profile
  name VARCHAR(200) NOT NULL,
  avatar_url TEXT,
  
  -- Patient-specific (null for non-patients)
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,
  
  -- Address (JSONB for flexibility)
  address JSONB,
  -- { address, city, state, pincode, landmark, lat, lng }
  
  -- Medical info (patients only)
  medical_conditions TEXT[],
  allergies TEXT[],
  
  -- Emergency contact
  emergency_contact JSONB,
  -- { name, phone, relationship }
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  
  -- Verification
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  
  -- Auth tracking
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  
  -- Search vector (updated by trigger in 008_functions_triggers.sql)
  search_vector TSVECTOR,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Full text search (using generated column)
CREATE INDEX idx_users_name_search ON users USING GIN(search_vector);

-- ============================================================
-- FAMILY MEMBERS (Patients can manage family health)
-- ============================================================

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Profile
  name VARCHAR(200) NOT NULL,
  relationship family_relationship NOT NULL,
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,
  
  -- Medical
  medical_conditions TEXT[],
  allergies TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_members_user ON family_members(user_id);

-- ============================================================
-- USER SESSIONS (JWT Refresh Tokens)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token
  refresh_token_hash TEXT NOT NULL,
  
  -- Device info
  device_id VARCHAR(255),
  device_type VARCHAR(50),
  device_name VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

-- ============================================================
-- OTP CODES
-- ============================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Target
  identifier VARCHAR(255) NOT NULL,  -- email or phone
  channel otp_channel NOT NULL,
  purpose otp_purpose NOT NULL,
  
  -- OTP
  code_hash TEXT NOT NULL,
  
  -- Tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Status
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_identifier ON otp_codes(identifier, purpose);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  token_hash TEXT NOT NULL UNIQUE,
  
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token_hash);

-- ============================================================
-- LOGIN HISTORY (Audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Attempt info
  identifier VARCHAR(255) NOT NULL,  -- email or phone used
  method VARCHAR(50) NOT NULL,       -- password, otp, google
  
  -- Status
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  
  -- Device info
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_login_history_time ON login_history(created_at DESC);

-- ============================================================
-- DEVICE TOKENS (Push Notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Token
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL,  -- ios, android, web
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = true;
