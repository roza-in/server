-- ============================================================
-- ROZX Healthcare Platform - Migration 002
-- Core Tables: Users, Specializations, Hospitals, Doctors
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- SPECIALIZATIONS MASTER TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  parent_id UUID REFERENCES specializations(id),  -- For sub-specializations
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common specializations
INSERT INTO specializations (name, display_name, description, sort_order) VALUES
  ('general_medicine', 'General Medicine', 'General health concerns and primary care', 1),
  ('cardiology', 'Cardiology', 'Heart and cardiovascular system', 2),
  ('orthopedics', 'Orthopedics', 'Bones, joints, and muscles', 3),
  ('pediatrics', 'Pediatrics', 'Child healthcare', 4),
  ('gynecology', 'Gynecology & Obstetrics', 'Women health and pregnancy', 5),
  ('dermatology', 'Dermatology', 'Skin, hair, and nails', 6),
  ('ent', 'ENT', 'Ear, Nose, and Throat', 7),
  ('ophthalmology', 'Ophthalmology', 'Eye care', 8),
  ('dentistry', 'Dentistry', 'Dental and oral health', 9),
  ('neurology', 'Neurology', 'Brain and nervous system', 10),
  ('psychiatry', 'Psychiatry', 'Mental health', 11),
  ('gastroenterology', 'Gastroenterology', 'Digestive system', 12),
  ('pulmonology', 'Pulmonology', 'Lungs and respiratory system', 13),
  ('nephrology', 'Nephrology', 'Kidneys', 14),
  ('urology', 'Urology', 'Urinary system', 15),
  ('endocrinology', 'Endocrinology', 'Hormones and metabolism', 16),
  ('oncology', 'Oncology', 'Cancer treatment', 17),
  ('rheumatology', 'Rheumatology', 'Autoimmune and joint diseases', 18),
  ('general_surgery', 'General Surgery', 'Surgical procedures', 19),
  ('physiotherapy', 'Physiotherapy', 'Physical rehabilitation', 20),
  ('ayurveda', 'Ayurveda', 'Traditional Indian medicine', 21),
  ('homeopathy', 'Homeopathy', 'Homeopathic medicine', 22),
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_specializations_name ON specializations(name);
CREATE INDEX IF NOT EXISTS idx_specializations_parent ON specializations(parent_id);

-- ============================================================
-- USERS TABLE
-- Central user table for all roles
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Authentication
  phone VARCHAR(15) NOT NULL UNIQUE,
  phone_verified BOOLEAN DEFAULT false,
  phone_verified_at TIMESTAMPTZ,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  password_hash VARCHAR(255),
  
  -- Basic Info
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  avatar_url TEXT,
  
  -- Patient specific fields
  date_of_birth DATE,
  gender gender,
  blood_group blood_group,
  height_cm INTEGER,                              -- Height in centimeters
  weight_kg DECIMAL(5,2),                         -- Weight in kilograms
  
  -- Address (JSONB for flexibility)
  address JSONB,
  -- Structure: { line1, line2, city, state, pincode, landmark }
  
  -- Emergency Contact
  emergency_contact JSONB,
  -- Structure: { name, phone, relationship }
  
  -- Medical Info (for patients)
  allergies TEXT[],
  chronic_conditions TEXT[],
  current_medications TEXT[],
  medical_history JSONB,
  -- Structure: { surgeries: [], hospitalizations: [], family_history: {} }
  
  -- Preferences
  preferred_language VARCHAR(20) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  -- Account Status
  is_active BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID,
  
  -- Auth tracking
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  login_count INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  -- Google OAuth
  google_id VARCHAR(255) UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================
-- HOSPITALS TABLE
-- Complete hospital profile with all PRD features
-- ============================================================

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,              -- SEO-friendly URL: rozx.health/hospitals/[city]/[slug]
  description TEXT,
  type hospital_type DEFAULT 'multi_specialty',
  
  -- Registration & Compliance
  registration_number VARCHAR(100) UNIQUE,        -- Medical Council registration
  license_number VARCHAR(100),
  gstin VARCHAR(20),                              -- GST number for invoicing
  pan VARCHAR(15),
  
  -- Contact Info
  phone VARCHAR(15) NOT NULL,
  alternate_phone VARCHAR(15),
  email VARCHAR(255),
  website VARCHAR(255),
  
  -- Address
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  landmark VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  country VARCHAR(50) DEFAULT 'India',
  
  -- Location (for geo-search)
  location JSONB,                                 -- { lat: number, lng: number }
  
  -- Branding
  logo_url TEXT,
  cover_image_url TEXT,
  images TEXT[],                                  -- Photo gallery
  brand_color VARCHAR(10),                        -- Primary brand color (hex)
  
  -- Services & Facilities
  specializations TEXT[],                         -- Array of specialization names
  amenities TEXT[],                               -- Parking, Pharmacy, etc.
  accreditations TEXT[],                          -- NABH, ISO, etc.
  insurance_accepted TEXT[],                      -- List of accepted insurance
  
  -- Capacity
  bed_count INTEGER DEFAULT 0,
  icu_count INTEGER DEFAULT 0,
  operation_theaters INTEGER DEFAULT 0,
  
  -- Services
  emergency_services BOOLEAN DEFAULT false,
  ambulance_services BOOLEAN DEFAULT false,
  pharmacy_available BOOLEAN DEFAULT false,
  lab_available BOOLEAN DEFAULT false,
  blood_bank BOOLEAN DEFAULT false,
  
  -- Working Hours (JSONB for flexibility)
  working_hours JSONB,
  -- Structure: { monday: { open: "09:00", close: "21:00" }, ... }
  
  -- Platform Settings
  subscription_tier subscription_tier DEFAULT 'free',
  platform_fee_percentage DECIMAL(4,2) DEFAULT 8.00,  -- Default 8% for online
  platform_fee_in_person DECIMAL(4,2) DEFAULT 4.00,   -- Default 4% for in-person
  
  -- Verification
  verification_status verification_status DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Ratings
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  
  -- Admin
  admin_user_id UUID REFERENCES users(id),
  
  -- Bank Details (for settlements)
  bank_details JSONB,
  -- Structure: { account_name, account_number, ifsc, bank_name, branch }
  
  -- Social Links
  social_links JSONB,
  -- Structure: { facebook, instagram, twitter, linkedin, youtube }
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hospital indexes
CREATE INDEX IF NOT EXISTS idx_hospitals_slug ON hospitals(slug);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals(state);
CREATE INDEX IF NOT EXISTS idx_hospitals_pincode ON hospitals(pincode);
CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(type);
CREATE INDEX IF NOT EXISTS idx_hospitals_verification ON hospitals(verification_status);
CREATE INDEX IF NOT EXISTS idx_hospitals_is_verified ON hospitals(is_verified);
CREATE INDEX IF NOT EXISTS idx_hospitals_is_active ON hospitals(is_active);
CREATE INDEX IF NOT EXISTS idx_hospitals_admin ON hospitals(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_rating ON hospitals(rating DESC);
CREATE INDEX IF NOT EXISTS idx_hospitals_created_at ON hospitals(created_at);

-- Full text search index for hospital search
CREATE INDEX IF NOT EXISTS idx_hospitals_search ON hospitals 
  USING GIN(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(description, '')));

-- ============================================================
-- DOCTORS TABLE
-- Complete doctor profile with all PRD features
-- ============================================================

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to user account
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  
  -- Professional Registration
  registration_number VARCHAR(100) UNIQUE,        -- Medical Council registration
  registration_council VARCHAR(100),              -- Which council (MCI, State, etc.)
  license_number VARCHAR(100),
  
  -- Professional Info
  specialization_id UUID REFERENCES specializations(id),
  specialization VARCHAR(100) NOT NULL,           -- Primary specialization name
  sub_specializations TEXT[],                     -- Additional specializations
  
  -- Qualifications (JSONB array)
  qualifications JSONB,
  -- Structure: [{ degree, institution, year }]
  
  years_of_experience INTEGER,
  bio TEXT,                                       -- 300 chars profile bio
  
  -- Consultation Fees
  consultation_fee DECIMAL(10,2),                 -- In-person fee
  online_consultation_fee DECIMAL(10,2),          -- Online fee
  follow_up_fee DECIMAL(10,2),                    -- Follow-up fee (usually lower)
  home_visit_fee DECIMAL(10,2),                   -- Home visit (future)
  
  -- Consultation Settings
  consultation_duration INTEGER DEFAULT 15,       -- Default slot duration (minutes)
  buffer_time INTEGER DEFAULT 5,                  -- Buffer between appointments
  max_patients_per_day INTEGER,                   -- Daily limit
  
  -- Languages
  languages TEXT[] DEFAULT ARRAY['English', 'Hindi'],
  
  -- Professional Highlights
  awards TEXT[],
  publications TEXT[],
  memberships TEXT[],                             -- Professional associations
  
  -- Media
  profile_image_url TEXT,
  signature_url TEXT,                             -- Digital signature for prescriptions
  video_intro_url TEXT,                           -- Introduction video
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  is_accepting_new_patients BOOLEAN DEFAULT true,
  accepts_online_consultation BOOLEAN DEFAULT true,
  accepts_in_person BOOLEAN DEFAULT true,
  
  -- Verification
  verification_status verification_status DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Ratings
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  
  -- Payment Settings (internal - for hospital to doctor payout)
  payout_model VARCHAR(50),                       -- fixed_amount, percentage, retainer
  payout_amount DECIMAL(10,2),                    -- Fixed amount or percentage
  payout_frequency VARCHAR(20),                   -- daily, weekly, monthly
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor indexes
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization_id ON doctors(specialization_id);
CREATE INDEX IF NOT EXISTS idx_doctors_verification ON doctors(verification_status);
CREATE INDEX IF NOT EXISTS idx_doctors_is_verified ON doctors(is_verified);
CREATE INDEX IF NOT EXISTS idx_doctors_is_available ON doctors(is_available);
CREATE INDEX IF NOT EXISTS idx_doctors_is_active ON doctors(is_active);
CREATE INDEX IF NOT EXISTS idx_doctors_rating ON doctors(rating DESC);
CREATE INDEX IF NOT EXISTS idx_doctors_fee ON doctors(consultation_fee);
CREATE INDEX IF NOT EXISTS idx_doctors_created_at ON doctors(created_at);

-- Full text search for doctor search
CREATE INDEX IF NOT EXISTS idx_doctors_search ON doctors 
  USING GIN(to_tsvector('english', coalesce(specialization, '') || ' ' || coalesce(bio, '')));

-- ============================================================
-- DOCTOR SCHEDULES TABLE
-- Weekly recurring schedules
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Schedule Details
  day_of_week day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Break Time (optional)
  break_start TIME,
  break_end TIME,
  
  -- Slot Configuration
  slot_duration INTEGER DEFAULT 15,               -- Minutes per slot
  max_appointments INTEGER,                       -- Max patients for this slot
  buffer_time INTEGER DEFAULT 5,                  -- Buffer between appointments
  
  -- Consultation Types Allowed
  consultation_types consultation_type[] DEFAULT ARRAY['in_person']::consultation_type[],
  
  -- Emergency Slots (reserved for urgent cases)
  emergency_slots INTEGER DEFAULT 0,
  
  -- Location (for doctors visiting multiple branches)
  hospital_id UUID REFERENCES hospitals(id),
  location_name VARCHAR(255),                     -- Custom location name
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(doctor_id, day_of_week, hospital_id)
);

-- Schedule indexes
CREATE INDEX IF NOT EXISTS idx_schedules_doctor ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON doctor_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_hospital ON doctor_schedules(hospital_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON doctor_schedules(is_active);

-- ============================================================
-- SCHEDULE OVERRIDES TABLE
-- Exceptions to regular schedule (holidays, special days)
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Override Details
  override_date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false,             -- false = day off
  
  -- Custom Hours (if available but different hours)
  start_time TIME,
  end_time TIME,
  
  -- Slot Configuration (if different from regular)
  slot_duration INTEGER,
  max_appointments INTEGER,
  consultation_types consultation_type[],
  
  -- Reason
  reason VARCHAR(255),                            -- "Personal Leave", "Conference", etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(doctor_id, override_date)
);

-- Override indexes
CREATE INDEX IF NOT EXISTS idx_overrides_doctor ON schedule_overrides(doctor_id);
CREATE INDEX IF NOT EXISTS idx_overrides_date ON schedule_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_overrides_available ON schedule_overrides(is_available);

-- ============================================================
-- END OF MIGRATION 002
-- ============================================================
