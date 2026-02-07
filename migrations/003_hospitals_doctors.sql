-- ============================================================
-- ROZX Healthcare Platform - Migration 003
-- Hospitals, Doctors & Schedules (Supabase Ready)
-- ============================================================

-- ============================================================
-- SPECIALIZATIONS (Master list)
-- ============================================================

CREATE TABLE IF NOT EXISTS specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  
  -- Hierarchy
  parent_id UUID REFERENCES specializations(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specializations_active ON specializations(is_active, display_order);

-- Seed default specializations
INSERT INTO specializations (name, slug, description, icon_url, display_order, is_active) VALUES
('General Physician', 'general-physician', 'Primary care doctors for general health issues', null, 1, true),
('Cardiologist', 'cardiologist', 'Heart and cardiovascular system specialists', null, 2, true),
('Dermatologist', 'dermatologist', 'Skin, hair, and nail specialists', null, 3, true),
('Pediatrician', 'pediatrician', 'Children and infant healthcare specialists', null, 4, true),
('Orthopedic', 'orthopedic', 'Bone, joint, and muscle specialists', null, 5, true),
('Gynecologist', 'gynecologist', 'Women''s reproductive health specialists', null, 6, true),
('Neurologist', 'neurologist', 'Brain and nervous system specialists', null, 7, true),
('ENT Specialist', 'ent-specialist', 'Ear, nose, and throat specialists', null, 8, true),
('Ophthalmologist', 'ophthalmologist', 'Eye care specialists', null, 9, true),
('Psychiatrist', 'psychiatrist', 'Mental health specialists', null, 10, true),
('Dentist', 'dentist', 'Oral and dental health specialists', null, 11, true),
('Pulmonologist', 'pulmonologist', 'Lung and respiratory specialists', null, 12, true),
('Gastroenterologist', 'gastroenterologist', 'Digestive system specialists', null, 13, true),
('Urologist', 'urologist', 'Urinary tract and male reproductive specialists', null, 14, true),
('Nephrologist', 'nephrologist', 'Kidney specialists', null, 15, true),
('Endocrinologist', 'endocrinologist', 'Hormone and metabolism specialists', null, 16, true),
('Oncologist', 'oncologist', 'Cancer specialists', null, 17, true),
('Rheumatologist', 'rheumatologist', 'Arthritis and autoimmune disease specialists', null, 18, true),
('General Surgeon', 'general-surgeon', 'Surgical specialists for various conditions', null, 19, true),
('Physiotherapist', 'physiotherapist', 'Physical rehabilitation specialists', null, 20, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- HOSPITALS
-- ============================================================

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner (hospital role user)
  admin_user_id UUID NOT NULL,
  CONSTRAINT hospitals_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  type hospital_type NOT NULL DEFAULT 'clinic',
  
  -- Description
  description TEXT,
  
  -- Contact
  email VARCHAR(255),
  phone VARCHAR(15) NOT NULL,
  alternate_phone VARCHAR(15),
  website TEXT,
  
  -- Address
  address VARCHAR(255),
  landmark VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  country VARCHAR(50) DEFAULT 'India',
  location JSONB,  -- { lat, lng }
  
  -- Registration & Compliance
  registration_number VARCHAR(100),
  gstin VARCHAR(20),
  pan VARCHAR(20),
  
  -- Facilities
  facilities TEXT[],  -- ['parking', 'pharmacy', 'cafeteria']
  
  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  photos TEXT[],
  
  -- SEO Fields (For Next.js 16 SSR/ISR)
  meta_title VARCHAR(70),           -- Google truncates at ~60 chars
  meta_description VARCHAR(160),     -- Google shows ~155 chars
  meta_keywords TEXT[],              -- Focus keywords for the page
  og_image_url TEXT,                 -- Open Graph image (1200x630 recommended)
  canonical_slug VARCHAR(255),       -- If different from slug
  
  -- Schema.org LocalBusiness Data
  schema_type VARCHAR(100) DEFAULT 'MedicalOrganization',  -- or Hospital, Clinic
  founding_year INTEGER,
  number_of_employees VARCHAR(20),   -- For schema.org
  accepted_insurance TEXT[],         -- Health insurance accepted
  payment_methods_accepted TEXT[],   -- For schema.org
  area_served TEXT[],                -- Cities/areas served
  
  -- Local SEO
  google_place_id VARCHAR(100),      -- For Google Maps integration
  google_maps_url TEXT,
  
  -- Social Links (For structured data)
  social_links JSONB,
  -- { facebook, twitter, instagram, linkedin, youtube }
  
  -- Working Hours
  working_hours JSONB,
  -- { monday: { open: "09:00", close: "18:00" }, ... }
  
  -- Platform Settings (Read-only for hospital)
  platform_commission_percent DECIMAL(4,2) DEFAULT 8.00,
  medicine_commission_percent DECIMAL(4,2) DEFAULT 5.00,
  
  -- Verification
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Ratings (auto-calculated)
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  
  -- Stats (auto-calculated)
  total_doctors INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  
  -- Search vector (updated by trigger in 008_functions_triggers.sql)
  search_vector TSVECTOR,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hospitals_admin ON hospitals(admin_user_id);
CREATE INDEX idx_hospitals_city ON hospitals(city);
CREATE INDEX idx_hospitals_pincode ON hospitals(pincode);
CREATE INDEX idx_hospitals_type ON hospitals(type);
CREATE INDEX idx_hospitals_active ON hospitals(is_active, verification_status);
CREATE INDEX idx_hospitals_rating ON hospitals(rating DESC);

-- Full text search (using generated column)
CREATE INDEX idx_hospitals_search ON hospitals USING GIN(search_vector);

-- ============================================================
-- HOSPITAL STAFF (Reception users linked to hospital)
-- ============================================================

CREATE TABLE IF NOT EXISTS hospital_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role within hospital
  staff_role VARCHAR(50) NOT NULL DEFAULT 'reception',
  designation VARCHAR(100),
  
  -- Permissions
  can_book_appointments BOOLEAN DEFAULT true,
  can_mark_payments BOOLEAN DEFAULT true,
  can_view_patient_info BOOLEAN DEFAULT false,
  can_print_documents BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hospital_id, user_id)
);

CREATE INDEX idx_hospital_staff_hospital ON hospital_staff(hospital_id);
CREATE INDEX idx_hospital_staff_user ON hospital_staff(user_id);

-- ============================================================
-- DOCTORS
-- ============================================================

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Hospital association
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Primary specialization
  specialization_id UUID NOT NULL REFERENCES specializations(id),
  
  -- Additional specializations
  additional_specializations UUID[],
  
  -- Professional Info
  registration_number VARCHAR(100) NOT NULL,
  registration_council VARCHAR(100),
  registration_year INTEGER,
  
  -- Qualifications
  qualifications TEXT[],  -- ['MBBS', 'MD - Cardiology']
  experience_years INTEGER DEFAULT 0,
  
  -- Bio
  bio TEXT,
  languages TEXT[] DEFAULT ARRAY['English', 'Hindi'],
  
  -- SEO Fields (For Next.js 16 SSR/ISR)
  slug VARCHAR(255),                  -- URL-friendly: dr-rajesh-kumar-cardiologist-delhi
  meta_title VARCHAR(70),             -- "Dr. Rajesh Kumar - Cardiologist in Delhi | ROZX"
  meta_description VARCHAR(160),       -- Rich description for SERP
  meta_keywords TEXT[],
  og_image_url TEXT,                   -- Professional photo for OG
  profile_video_url TEXT,              -- Video introduction (boosts rank)
  
  -- Schema.org Physician Data
  npi_number VARCHAR(20),              -- National Provider Identifier (if applicable)
  medical_specialty_schema TEXT[],     -- Schema.org MedicalSpecialty values
  available_service TEXT[],            -- Services offered (schema.org)
  hospital_affiliation TEXT[],         -- Other hospital names for structured data
  
  -- Awards & Recognition (boosts E-E-A-T)
  awards TEXT[],                        -- "Best Cardiologist 2023", etc.
  publications TEXT[],                  -- Research papers
  certifications TEXT[],                -- Board certifications
  memberships TEXT[],                   -- "Indian Medical Association", etc.
  
  -- Social profiles (for sameAs in schema.org)
  social_profiles JSONB,
  -- { linkedin, twitter, researchgate, pubmed, healthgrades }
  
  -- Consultation Settings
  consultation_types consultation_type[] DEFAULT ARRAY['in_person'::consultation_type],
  online_consultation_enabled BOOLEAN DEFAULT false,
  walk_in_enabled BOOLEAN DEFAULT true,
  
  -- Fees (set by hospital admin)
  consultation_fee_online DECIMAL(10,2) DEFAULT 0,
  consultation_fee_in_person DECIMAL(10,2) DEFAULT 0,
  consultation_fee_walk_in DECIMAL(10,2) DEFAULT 0,
  follow_up_fee DECIMAL(10,2) DEFAULT 0,
  follow_up_validity_days INTEGER DEFAULT 7,
  
  -- Slot configuration
  slot_duration_minutes INTEGER DEFAULT 15,
  buffer_time_minutes INTEGER DEFAULT 5,
  max_patients_per_slot INTEGER DEFAULT 1,
  
  -- Verification
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  
  -- Ratings
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  
  -- Search vector (updated by trigger in 008_functions_triggers.sql)
  search_vector TSVECTOR,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, hospital_id)
);

-- Indexes
CREATE INDEX idx_doctors_user ON doctors(user_id);
CREATE INDEX idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX idx_doctors_specialization ON doctors(specialization_id);
CREATE INDEX idx_doctors_active ON doctors(is_active, is_available);
CREATE INDEX idx_doctors_rating ON doctors(rating DESC);

-- Full text search (using generated column)
CREATE INDEX idx_doctors_search ON doctors USING GIN(search_vector);

-- ============================================================
-- DOCTOR SCHEDULES (Weekly recurring)
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Schedule
  day_of_week day_of_week NOT NULL,
  consultation_type consultation_type NOT NULL DEFAULT 'in_person',
  
  -- Time slots
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Break (optional)
  break_start TIME,
  break_end TIME,
  
  -- Slot configuration (override doctor defaults)
  slot_duration_minutes INTEGER,
  max_patients_per_slot INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate schedules (same doctor, day, start time) only for ACTIVE schedules
-- This allows same doctor to have the same start_time on same day if the old one is inactive
CREATE UNIQUE INDEX idx_doctor_schedules_unique_active 
ON doctor_schedules (doctor_id, day_of_week, start_time) 
WHERE (is_active = true);

CREATE INDEX idx_schedules_doctor ON doctor_schedules(doctor_id);
CREATE INDEX idx_schedules_day ON doctor_schedules(day_of_week);
CREATE INDEX idx_schedules_active ON doctor_schedules(doctor_id, is_active) WHERE is_active = true;

-- ============================================================
-- SCHEDULE OVERRIDES (Holidays, leaves, special hours)
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Override date
  override_date DATE NOT NULL,
  
  -- Type
  override_type schedule_override_type NOT NULL,
  
  -- If special hours, specify times
  start_time TIME,
  end_time TIME,
  
  -- Reason
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(doctor_id, override_date)
);

CREATE INDEX idx_overrides_doctor ON schedule_overrides(doctor_id);
CREATE INDEX idx_overrides_date ON schedule_overrides(override_date);
