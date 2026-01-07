-- ============================================================
-- ROZX Healthcare Platform - Migration 003
-- Health Records: Family Members, Documents, Vitals
-- Patient Health Record (PHR) System
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- FAMILY MEMBERS TABLE
-- Patients can manage health of family members
-- ============================================================

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Primary Account Holder
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Family Member Details
  full_name VARCHAR(255) NOT NULL,
  relationship family_relationship NOT NULL,
  
  -- Personal Info
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,
  phone VARCHAR(15),                              -- Optional phone for adults
  
  -- Health Info
  allergies TEXT[],
  chronic_conditions TEXT[],
  current_medications TEXT[],
  medical_history JSONB,
  
  -- Media
  avatar_url TEXT,
  
  -- Access Control
  can_book_independently BOOLEAN DEFAULT false,   -- For adult family members
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family member indexes
CREATE INDEX IF NOT EXISTS idx_family_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_relationship ON family_members(relationship);
CREATE INDEX IF NOT EXISTS idx_family_active ON family_members(is_active);

-- ============================================================
-- HEALTH DOCUMENTS TABLE
-- Store all patient medical documents
-- ============================================================

CREATE TABLE IF NOT EXISTS health_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner (user or family member)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  
  -- Document Details
  type document_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- File Info
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),                          -- pdf, jpg, png, etc.
  file_size INTEGER,                              -- Size in bytes
  
  -- Source
  source VARCHAR(50),                             -- rozx, uploaded, hospital, lab
  source_id UUID,                                 -- Reference to prescription/lab_report id
  
  -- Related Entities
  hospital_id UUID REFERENCES hospitals(id),
  doctor_id UUID REFERENCES doctors(id),
  appointment_id UUID,                            -- Reference set later after appointments table
  
  -- Document Date
  document_date DATE,                             -- When the document was created
  valid_until DATE,                               -- For certificates, prescriptions
  
  -- Access Control
  is_shared_with_doctors BOOLEAN DEFAULT true,    -- Doctors can view
  shared_with TEXT[],                             -- Specific user IDs with access
  
  -- Tags for easy search
  tags TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user ON health_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_family ON health_documents(family_member_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON health_documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_hospital ON health_documents(hospital_id);
CREATE INDEX IF NOT EXISTS idx_documents_doctor ON health_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_documents_date ON health_documents(document_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created ON health_documents(created_at DESC);

-- ============================================================
-- PATIENT VITALS TABLE
-- Track patient vitals over time
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Patient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  
  -- Vitals
  blood_pressure_systolic INTEGER,                -- mmHg
  blood_pressure_diastolic INTEGER,               -- mmHg
  heart_rate INTEGER,                             -- BPM
  temperature DECIMAL(4,1),                       -- Celsius
  respiratory_rate INTEGER,                       -- Breaths per minute
  oxygen_saturation INTEGER,                      -- SpO2 %
  weight_kg DECIMAL(5,2),
  height_cm INTEGER,
  bmi DECIMAL(4,1),
  
  -- Blood Sugar
  blood_sugar_fasting INTEGER,                    -- mg/dL
  blood_sugar_pp INTEGER,                         -- Post-prandial mg/dL
  blood_sugar_random INTEGER,                     -- Random mg/dL
  
  -- Source
  recorded_by VARCHAR(50),                        -- self, doctor, device
  device_type VARCHAR(100),                       -- If recorded via device
  
  -- Related
  appointment_id UUID,                            -- If recorded during consultation
  
  -- Notes
  notes TEXT,
  
  -- Recorded At
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vitals indexes
CREATE INDEX IF NOT EXISTS idx_vitals_user ON patient_vitals(user_id);
CREATE INDEX IF NOT EXISTS idx_vitals_family ON patient_vitals(family_member_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded ON patient_vitals(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vitals_appointment ON patient_vitals(appointment_id);

-- ============================================================
-- MEDICATION REMINDERS TABLE
-- For medicine adherence tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Patient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  
  -- Medication Details
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),                            -- e.g., "5mg", "1 tablet"
  frequency VARCHAR(50),                          -- e.g., "1-0-1", "twice daily"
  
  -- Schedule
  reminder_times TIME[],                          -- Array of times
  start_date DATE NOT NULL,
  end_date DATE,                                  -- Null if ongoing
  
  -- Instructions
  instructions TEXT,                              -- Before meal, after meal, etc.
  
  -- Source
  prescription_id UUID,                           -- Reference to prescription
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user ON medication_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_family ON medication_reminders(family_member_id);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON medication_reminders(is_active);
CREATE INDEX IF NOT EXISTS idx_reminders_dates ON medication_reminders(start_date, end_date);

-- ============================================================
-- MEDICATION LOGS TABLE
-- Track medication intake
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Log Details
  scheduled_time TIMESTAMPTZ NOT NULL,
  taken_at TIMESTAMPTZ,                           -- When actually taken
  status VARCHAR(20) NOT NULL,                    -- taken, missed, skipped
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medication log indexes
CREATE INDEX IF NOT EXISTS idx_med_logs_reminder ON medication_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_med_logs_user ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_med_logs_scheduled ON medication_logs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_med_logs_status ON medication_logs(status);

-- ============================================================
-- END OF MIGRATION 003
-- ============================================================
