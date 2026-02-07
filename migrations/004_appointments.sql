-- ============================================================
-- ROZX Healthcare Platform - Migration 004
-- Appointments, Consultations & Prescriptions (Supabase Ready)
-- ============================================================

-- ============================================================
-- APPOINTMENT SLOTS (Generated from schedules)
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  
  -- Slot timing
  slot_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Type
  consultation_type consultation_type NOT NULL DEFAULT 'in_person',
  
  -- Capacity
  max_bookings INTEGER DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  
  -- Slot locking (race condition prevention)
  locked_until TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  lock_version INTEGER DEFAULT 0,
  
  -- Status
  is_available BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast slot lookup
CREATE INDEX idx_slots_doctor_date ON appointment_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_start_time ON appointment_slots(start_time);
CREATE INDEX idx_slots_available ON appointment_slots(doctor_id, is_available, slot_date) 
  WHERE is_available = true;
CREATE UNIQUE INDEX idx_slots_unique ON appointment_slots(doctor_id, start_time, consultation_type);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference number
  appointment_number VARCHAR(20) UNIQUE,
  
  -- Parties
  patient_id UUID NOT NULL REFERENCES users(id),
  family_member_id UUID REFERENCES family_members(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  slot_id UUID REFERENCES appointment_slots(id),
  
  -- Type
  consultation_type consultation_type NOT NULL,
  booking_source booking_source NOT NULL DEFAULT 'app',
  
  -- For walk-in (reception booking)
  walk_in_token VARCHAR(20),
  booked_by_user_id UUID REFERENCES users(id),  -- Reception user if walk-in
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  
  -- Actual timing
  checked_in_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Status
  status appointment_status NOT NULL DEFAULT 'pending_payment',
  status_reason TEXT,
  
  -- Fees
  consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Commission
  platform_commission DECIMAL(10,2) DEFAULT 0,
  hospital_amount DECIMAL(10,2) DEFAULT 0,  -- After commission
  
  -- Payment (for walk-in cash payments)
  payment_method payment_method,
  payment_collected_by UUID REFERENCES users(id),
  payment_collected_at TIMESTAMPTZ,
  
  -- Idempotency
  idempotency_key VARCHAR(100) UNIQUE,
  
  -- Follow-up
  is_follow_up BOOLEAN DEFAULT false,
  parent_appointment_id UUID REFERENCES appointments(id),
  follow_up_valid_until DATE,
  
  -- Rescheduling
  reschedule_count INTEGER DEFAULT 0,
  rescheduled_from UUID REFERENCES appointments(id),
  
  -- Notes
  patient_notes TEXT,
  internal_notes TEXT,
  
  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_number ON appointments(appointment_number);
CREATE INDEX idx_appointments_slot ON appointments(slot_id) WHERE slot_id IS NOT NULL;

-- Composite for dashboard queries
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, scheduled_date, status);
CREATE INDEX idx_appointments_hospital_date ON appointments(hospital_id, scheduled_date, status);

-- ============================================================
-- CONSULTATIONS (Actual consultation session)
-- ============================================================

CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Status
  status consultation_status NOT NULL DEFAULT 'scheduled',
  
  -- Video (for online consultations)
  room_id VARCHAR(255),
  room_url TEXT,
  room_token TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Clinical notes (by doctor)
  chief_complaint TEXT,
  history_of_illness TEXT,
  examination_findings TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  
  -- Vitals (if recorded)
  vitals JSONB,
  -- { bp: "120/80", pulse: 72, temp: 98.6, weight: 70, height: 175 }
  
  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  follow_up_days INTEGER,
  
  -- Attachments
  attachments JSONB,  -- [{ type, url, name }]
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_room ON consultations(room_id) WHERE room_id IS NOT NULL;

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Unique reference
  prescription_number VARCHAR(20) UNIQUE,
  
  -- Relationships
  consultation_id UUID NOT NULL REFERENCES consultations(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  
  -- Diagnosis
  diagnosis TEXT[],
  
  -- Medications (picked from ROZX pharmacy catalog)
  medications JSONB NOT NULL,
  -- [{ medicine_id, name, dosage, frequency, duration, quantity, instructions, meal_timing }]
  
  -- Additional instructions
  diet_advice TEXT,
  lifestyle_advice TEXT,
  general_instructions TEXT,
  
  -- Tests recommended
  lab_tests TEXT[],
  imaging_tests TEXT[],
  
  -- Validity
  valid_until DATE,
  
  -- Status
  is_digital BOOLEAN DEFAULT true,
  is_downloaded BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  
  -- Order tracking
  medicine_ordered BOOLEAN DEFAULT false,
  medicine_order_id UUID,  -- FK added later
  
  -- PDF
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX idx_prescriptions_created ON prescriptions(created_at DESC);

-- ============================================================
-- RATINGS & REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),
  
  -- Rating
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  -- Review
  review TEXT,
  
  -- Specific ratings
  doctor_rating INTEGER CHECK (doctor_rating >= 1 AND doctor_rating <= 5),
  hospital_rating INTEGER CHECK (hospital_rating >= 1 AND hospital_rating <= 5),
  wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),
  
  -- Moderation
  is_visible BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(appointment_id, patient_id)
);

CREATE INDEX idx_ratings_doctor ON ratings(doctor_id, is_visible);
CREATE INDEX idx_ratings_hospital ON ratings(hospital_id, is_visible);
CREATE INDEX idx_ratings_patient ON ratings(patient_id);

-- ============================================================
-- HEALTH DOCUMENTS (Patient uploads)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Owner
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  
  -- Document
  document_type document_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- File
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  
  -- Metadata
  document_date DATE,
  hospital_name VARCHAR(255),
  doctor_name VARCHAR(255),
  
  -- Related appointment/consultation
  appointment_id UUID REFERENCES appointments(id),
  consultation_id UUID REFERENCES consultations(id),
  
  -- Access control
  is_shared BOOLEAN DEFAULT false,
  shared_doctors UUID[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_patient ON health_documents(patient_id);
CREATE INDEX idx_documents_type ON health_documents(patient_id, document_type);
CREATE INDEX idx_documents_family ON health_documents(family_member_id) WHERE family_member_id IS NOT NULL;

-- ============================================================
-- APPOINTMENT ATTACHMENTS (Patient uploads for appointments)
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- File
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  
  -- Metadata
  description TEXT,
  
  -- Uploaded by
  uploaded_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointment_attachments ON appointment_attachments(appointment_id);

-- ============================================================
-- PATIENT VITALS (Health tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Patient
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  
  -- Related consultation (optional)
  consultation_id UUID REFERENCES consultations(id),
  
  -- Vital signs
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse_rate INTEGER,
  temperature DECIMAL(4,1),  -- in Fahrenheit
  weight DECIMAL(5,2),       -- in kg
  height DECIMAL(5,2),       -- in cm
  spo2 INTEGER,              -- oxygen saturation
  blood_sugar_fasting DECIMAL(5,1),
  blood_sugar_pp DECIMAL(5,1),
  
  -- BMI (auto-calculated)
  bmi DECIMAL(4,1),
  
  -- Notes
  notes TEXT,
  
  -- Who recorded
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_vitals_patient ON patient_vitals(patient_id);
CREATE INDEX idx_patient_vitals_consultation ON patient_vitals(consultation_id) WHERE consultation_id IS NOT NULL;
CREATE INDEX idx_patient_vitals_date ON patient_vitals(patient_id, recorded_at DESC);

-- ============================================================
-- MEDICATION REMINDERS (Pill reminders)
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Patient
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  
  -- Related prescription (optional)
  prescription_id UUID REFERENCES prescriptions(id),
  
  -- Medicine
  medicine_id UUID,  -- If from ROZX catalog
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  instructions TEXT,
  
  -- Schedule
  frequency VARCHAR(50) NOT NULL,  -- once_daily, twice_daily, thrice_daily, etc.
  reminder_times TIME[] NOT NULL,  -- Array of times
  meal_timing VARCHAR(20),  -- before_meal, after_meal, with_meal
  
  -- Duration
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Notification
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medication_reminders_patient ON medication_reminders(patient_id);
CREATE INDEX idx_medication_reminders_active ON medication_reminders(patient_id, is_active) WHERE is_active = true;
CREATE INDEX idx_medication_reminders_prescription ON medication_reminders(prescription_id) WHERE prescription_id IS NOT NULL;

-- ============================================================
-- MEDICATION LOGS (Compliance tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),
  
  -- Scheduled time
  scheduled_time TIMESTAMPTZ NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, taken, skipped, missed
  
  -- Action
  taken_at TIMESTAMPTZ,
  skipped_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medication_logs_reminder ON medication_logs(reminder_id);
CREATE INDEX idx_medication_logs_patient ON medication_logs(patient_id, scheduled_time);
CREATE INDEX idx_medication_logs_status ON medication_logs(patient_id, status, scheduled_time);

