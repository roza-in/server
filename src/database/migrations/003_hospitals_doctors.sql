-- ============================================================
-- ROZX Healthcare Platform — Migration 003
-- Hospitals, Doctors & Schedules
-- ============================================================
-- Depends on: 002 (users)
-- ============================================================

-- ======================== SPECIALIZATIONS ========================

CREATE TABLE specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  long_description TEXT,                      -- SEO: Rich content for specialty landing pages
  icon_url TEXT,
  banner_url TEXT,

  -- SEO Metadata
  meta_title VARCHAR(70),                     -- SEO: Custom <title> (falls back to name)
  meta_description VARCHAR(160),              -- SEO: Custom meta description
  og_image_url TEXT,                          -- SEO: Open Graph image

  -- Keyword Targeting
  common_conditions TEXT[],                   -- SEO: "diabetes", "thyroid" etc for keyword targeting
  search_keywords TEXT[],                     -- SEO: Additional keyword variants

  -- FAQ Schema (renders as JSON-LD FAQPage)
  faq_content JSONB,                          -- SEO: [{"q": "...", "a": "..."}] for FAQ schema markup

  parent_id UUID REFERENCES specializations(id),

  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specializations_active ON specializations(is_active, display_order);

-- Seed specializations
INSERT INTO specializations (name, slug, description, display_order, is_active) VALUES
  -- Primary Care
  ('General Physician',        'general-physician',        'Primary care doctors for general health issues',                    1,  true),
  ('Family Medicine',          'family-medicine',          'Comprehensive healthcare for the whole family',                     2,  true),
  ('Internal Medicine',        'internal-medicine',        'Specialists in adult diseases and complex diagnoses',               3,  true),

  -- Cardiology & Vascular
  ('Cardiologist',             'cardiologist',             'Heart and cardiovascular system specialists',                       4,  true),
  ('Cardiac Surgeon',          'cardiac-surgeon',          'Open-heart surgery and bypass specialists',                         5,  true),
  ('Vascular Surgeon',         'vascular-surgeon',         'Blood vessel and circulatory system surgeons',                      6,  true),

  -- Brain & Neuro
  ('Neurologist',              'neurologist',              'Brain and nervous system specialists',                              7,  true),
  ('Neurosurgeon',             'neurosurgeon',             'Surgical specialists for brain and spine conditions',               8,  true),
  ('Psychiatrist',             'psychiatrist',             'Mental health and behavioral disorder specialists',                 9,  true),
  ('Psychologist',             'psychologist',             'Counseling, therapy, and mental wellness specialists',             10,  true),

  -- Women & Children
  ('Gynecologist',             'gynecologist',             'Women''s reproductive health specialists',                         11,  true),
  ('Obstetrician',             'obstetrician',             'Pregnancy, childbirth, and postnatal care specialists',            12,  true),
  ('Pediatrician',             'pediatrician',             'Children and infant healthcare specialists',                       13,  true),
  ('Neonatologist',            'neonatologist',            'Newborn and premature baby intensive care specialists',            14,  true),
  ('Pediatric Surgeon',        'pediatric-surgeon',        'Surgical specialists for children and infants',                    15,  true),

  -- Bones & Muscles
  ('Orthopedic',               'orthopedic',               'Bone, joint, and muscle specialists',                             16,  true),
  ('Spine Surgeon',            'spine-surgeon',            'Spinal cord and vertebral column surgical specialists',            17,  true),
  ('Rheumatologist',           'rheumatologist',           'Arthritis and autoimmune disease specialists',                     18,  true),
  ('Sports Medicine',          'sports-medicine',          'Athletic injuries and exercise-related conditions',                19,  true),
  ('Physiotherapist',          'physiotherapist',          'Physical rehabilitation specialists',                              20,  true),

  -- Skin, Hair & Aesthetics
  ('Dermatologist',            'dermatologist',            'Skin, hair, and nail specialists',                                 21,  true),
  ('Cosmetologist',            'cosmetologist',            'Aesthetic medicine, laser treatments, and skin rejuvenation',       22,  true),
  ('Plastic Surgeon',          'plastic-surgeon',          'Reconstructive and cosmetic surgery specialists',                  23,  true),
  ('Trichologist',             'trichologist',             'Hair loss, scalp disorders, and hair restoration specialists',      24,  true),

  -- Eye, Ear, Nose & Throat
  ('Ophthalmologist',          'ophthalmologist',          'Eye care and vision specialists',                                  25,  true),
  ('ENT Specialist',           'ent-specialist',           'Ear, nose, and throat specialists',                                26,  true),
  ('Audiologist',              'audiologist',              'Hearing and balance disorder specialists',                          27,  true),

  -- Dental
  ('Dentist',                  'dentist',                  'Oral and dental health specialists',                                28,  true),
  ('Orthodontist',             'orthodontist',             'Dental alignment, braces, and teeth straightening',                 29,  true),
  ('Oral Surgeon',             'oral-surgeon',             'Wisdom teeth removal, jaw surgery, and dental implants',            30,  true),

  -- Digestive & Liver
  ('Gastroenterologist',       'gastroenterologist',       'Digestive system specialists',                                     31,  true),
  ('Hepatologist',             'hepatologist',             'Liver disease specialists',                                         32,  true),
  ('Proctologist',             'proctologist',             'Colon, rectum, and anal disorder specialists',                     33,  true),
  ('Bariatric Surgeon',        'bariatric-surgeon',        'Weight loss surgery and obesity management specialists',            34,  true),

  -- Kidney & Urology
  ('Nephrologist',             'nephrologist',             'Kidney disease and dialysis specialists',                           35,  true),
  ('Urologist',                'urologist',                'Urinary tract and male reproductive specialists',                   36,  true),
  ('Andrologist',              'andrologist',              'Male fertility and sexual health specialists',                      37,  true),

  -- Lungs & Chest
  ('Pulmonologist',            'pulmonologist',            'Lung and respiratory specialists',                                  38,  true),
  ('Chest Surgeon',            'chest-surgeon',            'Thoracic surgery specialists for lung and chest conditions',         39,  true),
  ('Allergist',                'allergist',                'Allergy and immunology specialists',                                40,  true),

  -- Hormones & Metabolism
  ('Endocrinologist',          'endocrinologist',          'Hormone, thyroid, and metabolism specialists',                      41,  true),
  ('Diabetologist',            'diabetologist',            'Diabetes management and prevention specialists',                    42,  true),

  -- Cancer
  ('Oncologist',               'oncologist',               'Cancer diagnosis and treatment specialists',                        43,  true),
  ('Surgical Oncologist',      'surgical-oncologist',      'Cancer surgery specialists',                                        44,  true),
  ('Radiation Oncologist',     'radiation-oncologist',     'Radiation therapy for cancer treatment',                             45,  true),

  -- Blood & Infections
  ('Hematologist',             'hematologist',             'Blood disorders and transfusion medicine specialists',               46,  true),
  ('Infectious Disease',       'infectious-disease',       'Specialists in infections, tropical diseases, and epidemics',        47,  true),

  -- Surgery
  ('General Surgeon',          'general-surgeon',          'Surgical specialists for various conditions',                        48,  true),
  ('Laparoscopic Surgeon',     'laparoscopic-surgeon',     'Minimally invasive and keyhole surgery specialists',                 49,  true),

  -- Emergency & Critical Care
  ('Emergency Medicine',       'emergency-medicine',       'Acute illness and trauma emergency specialists',                     50,  true),
  ('Intensivist',              'intensivist',              'ICU and critical care medicine specialists',                          51,  true),
  ('Pain Management',          'pain-management',          'Chronic pain treatment and interventional specialists',              52,  true),
  ('Anesthesiologist',         'anesthesiologist',         'Anesthesia and perioperative care specialists',                      53,  true),

  -- Fertility & Sexual Health
  ('IVF Specialist',           'ivf-specialist',           'In-vitro fertilization and reproductive medicine specialists',       54,  true),
  ('Sexologist',               'sexologist',               'Sexual health, dysfunction, and relationship counseling',            55,  true),

  -- Lifestyle & Nutrition
  ('Dietitian',                'dietitian',                'Clinical nutrition, meal planning, and diet therapy',                56,  true),
  ('Nutritionist',             'nutritionist',             'Nutrition counseling and wellness specialists',                      57,  true),
  ('Geriatrician',             'geriatrician',             'Elderly care and age-related disease specialists',                   58,  true),

  -- Diagnostics
  ('Pathologist',              'pathologist',              'Lab diagnostics, biopsy, and disease detection specialists',          59,  true),
  ('Radiologist',              'radiologist',              'Medical imaging — X-ray, MRI, CT scan, and ultrasound',              60,  true),

  -- AYUSH (Indian Systems of Medicine)
  ('Ayurveda',                 'ayurveda',                 'Traditional Indian medicine — Panchakarma, herbal treatments, and holistic healing',  61,  true),
  ('Homeopathy',               'homeopathy',               'Alternative medicine using highly diluted natural substances',       62,  true),
  ('Unani',                    'unani',                    'Greco-Arabic traditional medicine system practiced in India',         63,  true),
  ('Siddha',                   'siddha',                   'Ancient Tamil system of medicine using herbs, minerals, and metals',  64,  true),
  ('Naturopathy',              'naturopathy',              'Natural healing — yoga, hydrotherapy, diet therapy, and detox',       65,  true),
  ('Yoga Therapist',           'yoga-therapist',           'Therapeutic yoga for chronic conditions, stress, and wellness',       66,  true),
  ('Acupuncturist',            'acupuncturist',            'Traditional Chinese needle therapy for pain and chronic conditions',  67,  true)
ON CONFLICT (name) DO NOTHING;

-- ======================== COMMISSION SLABS ========================

CREATE TABLE commission_slabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Slab range
  min_monthly_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_monthly_revenue DECIMAL(14,2),  -- NULL = unlimited

  -- Rates
  consultation_commission_percent DECIMAL(5,2) NOT NULL,
  medicine_commission_percent DECIMAL(5,2) NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_slabs_active ON commission_slabs(is_active) WHERE is_active = true;

-- ======================== HOSPITALS ========================

CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Owner
  admin_user_id UUID NOT NULL,
  CONSTRAINT hospitals_admin_fkey FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Basic
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  type hospital_type NOT NULL DEFAULT 'clinic',
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
  location JSONB,

  -- Compliance
  registration_number VARCHAR(100),
  gstin VARCHAR(20),
  pan VARCHAR(20),

  -- Facilities
  facilities TEXT[],

  -- Branding
  logo_url TEXT,
  banner_url TEXT,
  photos TEXT[],

  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  short_description VARCHAR(300),             -- SEO: Auto-gen meta desc fallback
  meta_keywords TEXT[],
  og_image_url TEXT,
  canonical_slug VARCHAR(255),
  noindex BOOLEAN DEFAULT false,              -- SEO: Exclude from sitemap/indexing
  last_content_update TIMESTAMPTZ,            -- SEO: For sitemap <lastmod>

  -- Schema.org (MedicalOrganization)
  schema_type VARCHAR(100) DEFAULT 'MedicalOrganization',
  founding_year INTEGER,
  number_of_employees VARCHAR(20),
  accepted_insurance TEXT[],
  payment_methods_accepted TEXT[],
  area_served TEXT[],
  also_known_as TEXT[],                       -- SEO: Alternate names for brand search
  accreditations TEXT[],                      -- SEO: NABH, JCI, ISO certifications
  departments TEXT[],                         -- SEO: "Cardiology", "Neurology" etc
  languages_spoken TEXT[] DEFAULT ARRAY['English', 'Hindi'],
  emergency_services BOOLEAN DEFAULT false,   -- SEO: schema.org hasEmergencyService

  -- Geo (separate for schema.org GeoCoordinates)
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),

  -- Maps
  google_place_id VARCHAR(100),
  google_maps_url TEXT,

  -- FAQ Schema
  faq_content JSONB,                          -- SEO: [{"q":"...","a":"..."}] for FAQ rich snippet

  -- Social
  social_links JSONB,
  working_hours JSONB,

  -- Commission (admin-controlled)
  -- NULL = Inherit from Slab or Global Config
  -- Value = Specific Hospital Override
  platform_commission_percent DECIMAL(4,2) DEFAULT NULL
    CONSTRAINT chk_hospital_platform_commission CHECK (platform_commission_percent BETWEEN 0 AND 100),
  medicine_commission_percent DECIMAL(4,2) DEFAULT NULL
    CONSTRAINT chk_hospital_medicine_commission CHECK (medicine_commission_percent BETWEEN 0 AND 100),
  
  commission_slab_id UUID REFERENCES commission_slabs(id) ON DELETE SET NULL,

  -- Verification
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  registration_certificate_url TEXT,
  license_url TEXT,
  license_number TEXT,
  gstin_certificate_url TEXT,
  review_notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Aggregates (trigger-maintained)
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_doctors INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,

  -- Search
  search_vector TSVECTOR,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hospitals_admin ON hospitals(admin_user_id);
CREATE INDEX idx_hospitals_city ON hospitals(city);
CREATE INDEX idx_hospitals_pincode ON hospitals(pincode);
CREATE INDEX idx_hospitals_type ON hospitals(type);
CREATE INDEX idx_hospitals_active ON hospitals(is_active, verification_status);
CREATE INDEX idx_hospitals_noindex ON hospitals(noindex) WHERE noindex = false;
CREATE INDEX idx_hospitals_rating ON hospitals(rating DESC);
CREATE INDEX idx_hospitals_search ON hospitals USING GIN(search_vector);
CREATE INDEX idx_hospitals_slug ON hospitals(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_hospitals_geo ON hospitals(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_hospitals_commission_slab ON hospitals(commission_slab_id) WHERE commission_slab_id IS NOT NULL;
CREATE INDEX idx_hospitals_verification_status ON hospitals(verification_status);

-- ======================== HOSPITAL STAFF ========================

CREATE TABLE hospital_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  staff_role VARCHAR(50) NOT NULL DEFAULT 'reception',
  designation VARCHAR(100),

  -- Permissions
  can_book_appointments BOOLEAN DEFAULT true,
  can_mark_payments BOOLEAN DEFAULT true,
  can_view_patient_info BOOLEAN DEFAULT false,
  can_print_documents BOOLEAN DEFAULT true,

  is_active BOOLEAN DEFAULT true,

  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(hospital_id, user_id)
);

CREATE INDEX idx_hospital_staff_hospital ON hospital_staff(hospital_id);
CREATE INDEX idx_hospital_staff_user ON hospital_staff(user_id);

-- ======================== DOCTORS ========================

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  specialization_id UUID NOT NULL REFERENCES specializations(id),

  additional_specializations UUID[],

  -- Professional
  registration_number VARCHAR(100) NOT NULL,
  registration_council VARCHAR(100),
  registration_year INTEGER,

  qualifications TEXT[],
  experience_years INTEGER DEFAULT 0
    CONSTRAINT chk_doctor_experience CHECK (experience_years >= 0),

  bio TEXT,
  short_bio VARCHAR(300),                      -- SEO: Auto-gen meta desc fallback
  languages TEXT[] DEFAULT ARRAY['English', 'Hindi'],
  consultation_languages TEXT[],              -- SEO: Languages for consultations (may differ)

  -- SEO
  slug VARCHAR(255),
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  meta_keywords TEXT[],
  og_image_url TEXT,
  profile_video_url TEXT,
  noindex BOOLEAN DEFAULT false,              -- SEO: Exclude from sitemap/indexing
  last_content_update TIMESTAMPTZ,            -- SEO: For sitemap <lastmod>
  featured BOOLEAN DEFAULT false,             -- SEO: Featured doctors get priority in listings

  -- Schema.org (Physician)
  npi_number VARCHAR(20),
  medical_specialty_schema TEXT[],
  available_service TEXT[],
  hospital_affiliation TEXT[],
  education JSONB,                            -- SEO: [{"degree":"MBBS","institution":"AIIMS","year":2010}]
  conditions_treated TEXT[],                  -- SEO: Keyword targeting ("diabetes", "hypertension")
  procedures_performed TEXT[],                -- SEO: Keyword targeting ("angioplasty", "arthroscopy")
  expertise_areas TEXT[],                     -- SEO: More granular than specialization

  -- E-E-A-T (Experience, Expertise, Authority, Trust)
  awards TEXT[],
  publications TEXT[],
  certifications TEXT[],
  memberships TEXT[],

  -- FAQ Schema
  faq_content JSONB,                          -- SEO: [{"q":"...","a":"..."}] for FAQ rich snippet

  social_profiles JSONB,

  -- Consultation settings
  consultation_types consultation_type[] DEFAULT ARRAY['in_person'::consultation_type],
  online_consultation_enabled BOOLEAN DEFAULT false,
  walk_in_enabled BOOLEAN DEFAULT true,

  -- Fees
  consultation_fee_online DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_doctor_fee_online CHECK (consultation_fee_online >= 0),
  consultation_fee_in_person DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_doctor_fee_in_person CHECK (consultation_fee_in_person >= 0),
  consultation_fee_walk_in DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_doctor_fee_walk_in CHECK (consultation_fee_walk_in >= 0),
  follow_up_fee DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_doctor_follow_up_fee CHECK (follow_up_fee >= 0),
  follow_up_validity_days INTEGER DEFAULT 7,

  -- Slot config
  slot_duration_minutes INTEGER DEFAULT 15
    CONSTRAINT chk_doctor_slot_duration CHECK (slot_duration_minutes > 0),
  buffer_time_minutes INTEGER DEFAULT 5
    CONSTRAINT chk_doctor_buffer_time CHECK (buffer_time_minutes >= 0),
  max_patients_per_slot INTEGER DEFAULT 1
    CONSTRAINT chk_doctor_max_patients CHECK (max_patients_per_slot >= 1),

  -- Verification
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  registration_certificate_url TEXT,
  license_url TEXT,
  license_number TEXT,
  review_notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,

  -- Aggregates
  rating DECIMAL(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,

  search_vector TSVECTOR,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, hospital_id)
);

CREATE INDEX idx_doctors_user ON doctors(user_id);
CREATE INDEX idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX idx_doctors_specialization ON doctors(specialization_id);
CREATE INDEX idx_doctors_active ON doctors(is_active, is_available);
CREATE INDEX idx_doctors_featured ON doctors(featured) WHERE featured = true;
CREATE INDEX idx_doctors_rating ON doctors(rating DESC);
CREATE INDEX idx_doctors_search ON doctors USING GIN(search_vector);
CREATE INDEX idx_doctors_slug ON doctors(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_doctors_verification_status ON doctors(verification_status);

-- ======================== DOCTOR SCHEDULES ========================

CREATE TABLE doctor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  day_of_week day_of_week NOT NULL,
  consultation_type consultation_type NOT NULL DEFAULT 'in_person',

  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  break_start TIME,
  break_end TIME,

  slot_duration_minutes INTEGER,
  max_patients_per_slot INTEGER,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active schedule per (doctor, day, start_time, consultation_type)
CREATE UNIQUE INDEX idx_schedules_unique_active
  ON doctor_schedules(doctor_id, day_of_week, start_time, consultation_type)
  WHERE is_active = true;

CREATE INDEX idx_schedules_doctor ON doctor_schedules(doctor_id);
CREATE INDEX idx_schedules_day ON doctor_schedules(day_of_week);
CREATE INDEX idx_schedules_active ON doctor_schedules(doctor_id, is_active) WHERE is_active = true;

-- ======================== SCHEDULE OVERRIDES ========================

CREATE TABLE schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  override_date DATE NOT NULL,
  override_type schedule_override_type NOT NULL,

  start_time TIME,
  end_time TIME,

  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(doctor_id, override_date)
);

CREATE INDEX idx_overrides_doctor ON schedule_overrides(doctor_id);
CREATE INDEX idx_overrides_date ON schedule_overrides(override_date);
