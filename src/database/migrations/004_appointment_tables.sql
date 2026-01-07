-- ============================================================
-- ROZX Healthcare Platform - Migration 004
-- Appointment System: Slots, Appointments, Consultations, Prescriptions, Waitlist
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- APPOINTMENT SLOTS TABLE
-- Pre-generated slots for fast booking (optional optimization)
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Doctor & Hospital
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  
  -- Slot Details
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Type
  consultation_type consultation_type NOT NULL DEFAULT 'in_person',
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,               -- Manually blocked
  blocked_reason VARCHAR(255),
  
  -- Booking Info (if booked)
  appointment_id UUID,                            -- Set when booked
  
  -- Status
  is_emergency_slot BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(doctor_id, slot_date, start_time, consultation_type)
);

-- Slot indexes
CREATE INDEX IF NOT EXISTS idx_slots_doctor ON appointment_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_slots_hospital ON appointment_slots(hospital_id);
CREATE INDEX IF NOT EXISTS idx_slots_date ON appointment_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_available ON appointment_slots(is_available);
CREATE INDEX IF NOT EXISTS idx_slots_type ON appointment_slots(consultation_type);
CREATE INDEX IF NOT EXISTS idx_slots_datetime ON appointment_slots(slot_date, start_time);

-- ============================================================
-- APPOINTMENTS TABLE
-- Core appointment booking table
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Booking Reference
  booking_id VARCHAR(20) NOT NULL UNIQUE,         -- Human readable: RZX + 7 chars
  
  -- Patient Info
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),  -- If booking for family
  
  -- Doctor & Hospital
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  
  -- Appointment Details
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  consultation_type consultation_type NOT NULL DEFAULT 'in_person',
  
  -- Status
  status appointment_status NOT NULL DEFAULT 'pending_payment',
  
  -- Patient Input
  symptoms TEXT,                                  -- Chief complaint
  reason TEXT,                                    -- Reason for visit
  patient_notes TEXT,                             -- Additional notes from patient
  
  -- Clinical Notes (filled by doctor/staff)
  doctor_notes TEXT,
  clinical_notes TEXT,
  
  -- Cancellation
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  
  -- Rescheduling
  rescheduled_from UUID REFERENCES appointments(id),
  rescheduled_to UUID,                            -- Forward reference
  
  -- Walk-in / Queue
  is_walk_in BOOLEAN DEFAULT false,
  token_number INTEGER,                           -- Token for walk-ins
  queue_position INTEGER,
  
  -- Follow-up
  is_follow_up BOOLEAN DEFAULT false,
  follow_up_of UUID REFERENCES appointments(id),
  follow_up_within_days INTEGER,                  -- Free follow-up period
  
  -- Check-in / Consultation Times
  checked_in_at TIMESTAMPTZ,
  waiting_started_at TIMESTAMPTZ,
  consultation_started_at TIMESTAMPTZ,
  consultation_ended_at TIMESTAMPTZ,
  
  -- Fees (snapshot at booking time)
  consultation_fee DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Source
  booked_via VARCHAR(50) DEFAULT 'web',           -- web, mobile, whatsapp, reception
  booked_by UUID REFERENCES users(id),            -- If booked by staff on behalf
  
  -- Reminders
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_booking_id ON appointments(booking_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_family ON appointments(family_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(consultation_type);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_date, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_follow_up ON appointments(follow_up_of);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments(created_at DESC);

-- Add foreign key for rescheduled_to (after table exists)
ALTER TABLE appointments 
  ADD CONSTRAINT fk_appointments_rescheduled_to 
  FOREIGN KEY (rescheduled_to) REFERENCES appointments(id);

-- Link slots to appointments
ALTER TABLE appointment_slots 
  ADD CONSTRAINT fk_slots_appointment 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- Link health_documents to appointments
ALTER TABLE health_documents 
  ADD CONSTRAINT fk_documents_appointment 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- Link vitals to appointments
ALTER TABLE patient_vitals 
  ADD CONSTRAINT fk_vitals_appointment 
  FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- ============================================================
-- CONSULTATIONS TABLE
-- Video consultation session details
-- ============================================================

CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Appointment Reference
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Participants
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  
  -- Video Call Details
  room_id VARCHAR(255),                           -- Agora/Twilio room ID
  room_token TEXT,                                -- Access token
  provider VARCHAR(50) DEFAULT 'agora',           -- agora, twilio, daily
  
  -- Status
  status consultation_status NOT NULL DEFAULT 'scheduled',
  
  -- Timing
  scheduled_duration INTEGER DEFAULT 15,          -- Minutes
  actual_duration INTEGER,                        -- Actual call duration
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Participants Status
  patient_joined_at TIMESTAMPTZ,
  doctor_joined_at TIMESTAMPTZ,
  patient_left_at TIMESTAMPTZ,
  doctor_left_at TIMESTAMPTZ,
  
  -- Call Quality Metrics
  patient_network_quality INTEGER,                -- 1-5 rating
  doctor_network_quality INTEGER,
  call_quality_score DECIMAL(3,1),
  
  -- Notes & Recording
  doctor_notes TEXT,                              -- Internal notes
  ai_transcript TEXT,                             -- AI-generated transcript
  recording_url TEXT,                             -- Call recording (with consent)
  recording_consent BOOLEAN DEFAULT false,
  
  -- Technical Info
  patient_device_info JSONB,
  doctor_device_info JSONB,
  
  -- Issues
  had_technical_issues BOOLEAN DEFAULT false,
  technical_issue_details TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_room ON consultations(room_id);
CREATE INDEX IF NOT EXISTS idx_consultations_started ON consultations(started_at);

-- ============================================================
-- PRESCRIPTIONS TABLE
-- Digital prescriptions with medicines, tests, advice
-- ============================================================

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Prescription ID (human readable)
  prescription_number VARCHAR(50) UNIQUE,         -- ROZX/[Hospital]/[Year]/[Seq]
  
  -- Clinical Info
  chief_complaints TEXT,
  history_of_present_illness TEXT,
  past_medical_history TEXT,
  examination_findings TEXT,
  diagnosis TEXT NOT NULL,
  diagnosis_icd_codes TEXT[],                     -- ICD-10 codes
  
  -- Vitals at time of prescription
  vitals JSONB,
  -- Structure: { bp_systolic, bp_diastolic, pulse, temp, weight, height }
  
  -- Medications (JSONB array)
  medications JSONB NOT NULL,
  -- Structure: [{
  --   name, generic_name, dosage, frequency, duration, 
  --   instructions, meal_relation, route, quantity
  -- }]
  
  -- Lab Tests Recommended
  lab_tests JSONB,
  -- Structure: [{ name, instructions, urgency }]
  
  -- Imaging/Other Investigations
  investigations JSONB,
  -- Structure: [{ type, name, instructions }]
  
  -- Advice
  lifestyle_advice TEXT[],
  dietary_advice TEXT[],
  general_advice TEXT,
  precautions TEXT,
  
  -- Follow-up
  follow_up_date DATE,
  follow_up_instructions TEXT,
  
  -- Validity
  valid_until DATE,                               -- Prescription validity
  
  -- Generated PDF
  pdf_url TEXT,
  
  -- Digital Signature
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  
  -- Sharing
  shared_via TEXT[],                              -- whatsapp, email, sms
  shared_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescription indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON prescriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_hospital ON prescriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions(created_at DESC);

-- Link medication_reminders to prescriptions
ALTER TABLE medication_reminders 
  ADD CONSTRAINT fk_reminders_prescription 
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id);

-- ============================================================
-- APPOINTMENT WAITLIST TABLE
-- Patients waiting for cancelled slots
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Patient
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  
  -- Doctor
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id),
  
  -- Preferred Slot Details
  preferred_date DATE,                            -- Specific date or null for any
  preferred_dates DATE[],                         -- Multiple preferred dates
  preferred_time_start TIME,
  preferred_time_end TIME,
  consultation_type consultation_type,
  
  -- Contact Preference
  notify_via TEXT[] DEFAULT ARRAY['whatsapp', 'sms'],
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',            -- active, notified, booked, expired, cancelled
  
  -- Notification Tracking
  notified_at TIMESTAMPTZ,
  notification_expires_at TIMESTAMPTZ,            -- 30 min to book after notification
  
  -- If booked
  booked_appointment_id UUID REFERENCES appointments(id),
  
  -- Priority
  priority INTEGER DEFAULT 0,                     -- Higher = more priority
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor ON appointment_waitlist(doctor_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_date ON appointment_waitlist(preferred_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON appointment_waitlist(created_at);

-- ============================================================
-- APPOINTMENT ATTACHMENTS TABLE
-- Files uploaded by patient before consultation
-- ============================================================

CREATE TABLE IF NOT EXISTS appointment_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- File Info
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  
  -- Description
  description TEXT,
  
  -- Uploaded By
  uploaded_by UUID NOT NULL REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attachment indexes
CREATE INDEX IF NOT EXISTS idx_attachments_appointment ON appointment_attachments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON appointment_attachments(uploaded_by);

-- ============================================================
-- END OF MIGRATION 004
-- ============================================================
