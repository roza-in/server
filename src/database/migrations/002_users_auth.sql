-- ============================================================
-- ROZX Healthcare Platform — Migration 002
-- Users & Authentication
-- ============================================================
-- Depends on: 001 (enums)
-- ============================================================

-- ======================== USERS ========================

CREATE TABLE users (
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
  cover_url TEXT,

  -- Patient-specific
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,

  -- Address
  address JSONB,

  -- Medical (patients)
  medical_conditions TEXT[],
  allergies TEXT[],

  -- Emergency contact
  emergency_contact JSONB,

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

  -- Full-text search
  search_vector TSVECTOR,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_search ON users USING GIN(search_vector);

-- ======================== FAMILY MEMBERS ========================

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  relationship family_relationship NOT NULL,
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,

  medical_conditions TEXT[],
  allergies TEXT[],

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_members_user ON family_members(user_id);

-- ======================== USER SESSIONS ========================

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  refresh_token_hash TEXT NOT NULL,

  device_id VARCHAR(255),
  device_type VARCHAR(50),
  device_name VARCHAR(255),
  ip_address INET,
  user_agent TEXT,

  is_active BOOLEAN DEFAULT true,

  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

-- ======================== OTP CODES ========================

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  identifier VARCHAR(255) NOT NULL,
  channel otp_channel NOT NULL,
  purpose otp_purpose NOT NULL,

  code_hash TEXT NOT NULL,

  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_identifier ON otp_codes(identifier, purpose);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

-- ======================== PASSWORD RESET TOKENS ========================

CREATE TABLE password_reset_tokens (
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

-- ======================== LOGIN HISTORY ========================

CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  identifier VARCHAR(255) NOT NULL,
  method VARCHAR(50) NOT NULL,

  success BOOLEAN NOT NULL,
  failure_reason TEXT,

  ip_address INET,
  user_agent TEXT,
  device_info JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_login_history_time ON login_history(created_at DESC);

-- ======================== DEVICE TOKENS ========================

CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = true;

-- ======================== TOKEN ROTATION SUPPORT (I4) ========================

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS token_family TEXT,
  ADD COLUMN IF NOT EXISTS previous_refresh_token_hash TEXT;

-- Index for token reuse detection (lookup by previous hash)
CREATE INDEX IF NOT EXISTS idx_user_sessions_prev_refresh_hash
  ON user_sessions (previous_refresh_token_hash)
  WHERE previous_refresh_token_hash IS NOT NULL AND is_active = true;

-- Index for token family revocation
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_family
  ON user_sessions (token_family)
  WHERE is_active = true;
