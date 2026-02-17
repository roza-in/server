-- ============================================================
-- ROZX Healthcare Platform — Migration 004
-- Appointments, Consultations & Patient Health
-- ============================================================
-- Depends on: 003 (hospitals, doctors)
-- ============================================================

-- ======================== APPOINTMENT SLOTS ========================

CREATE TABLE appointment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  slot_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,

  consultation_type consultation_type NOT NULL DEFAULT 'in_person',

  max_bookings INTEGER DEFAULT 1
    CONSTRAINT chk_slot_max_bookings CHECK (max_bookings >= 1),
  current_bookings INTEGER DEFAULT 0
    CONSTRAINT chk_slot_current_bookings CHECK (current_bookings >= 0),

  -- Optimistic locking
  locked_until TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  lock_version INTEGER DEFAULT 0,

  is_available BOOLEAN DEFAULT true,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slots_doctor_date ON appointment_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_start_time ON appointment_slots(start_time);
CREATE INDEX idx_slots_available ON appointment_slots(doctor_id, is_available, slot_date) WHERE is_available = true;
CREATE UNIQUE INDEX idx_slots_unique ON appointment_slots(doctor_id, start_time, consultation_type);

-- ======================== APPOINTMENTS ========================

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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

  -- Walk-in
  walk_in_token VARCHAR(20),
  booked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Schedule
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
  consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0
    CONSTRAINT chk_appt_consultation_fee CHECK (consultation_fee >= 0),
  platform_fee DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_appt_platform_fee CHECK (platform_fee >= 0),
  gst_amount DECIMAL(10,2) DEFAULT 0
    CONSTRAINT chk_appt_gst CHECK (gst_amount >= 0),
  total_amount DECIMAL(10,2) NOT NULL
    CONSTRAINT chk_appt_total_amount CHECK (total_amount >= 0),

  -- Commission
  platform_commission DECIMAL(10,2) DEFAULT 0,
  hospital_amount DECIMAL(10,2) DEFAULT 0,

  -- Cash payment (walk-in)
  payment_method payment_method,
  payment_collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_hospital ON appointments(hospital_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_number ON appointments(appointment_number);
CREATE INDEX idx_appointments_slot ON appointments(slot_id) WHERE slot_id IS NOT NULL;
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, scheduled_date, status);
CREATE INDEX idx_appointments_hospital_date ON appointments(hospital_id, scheduled_date, status);
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, scheduled_date DESC);

-- ======================== CONSULTATIONS ========================
-- FK: ON DELETE RESTRICT — medical records must never cascade-delete

CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,

  status consultation_status NOT NULL DEFAULT 'scheduled',

  -- Video
  room_id VARCHAR(255),
  room_url TEXT,
  room_token TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Clinical notes
  chief_complaint TEXT,
  history_of_illness TEXT,
  examination_findings TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,

  -- Vitals snapshot
  vitals JSONB,

  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  follow_up_days INTEGER,

  attachments JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX idx_consultations_status ON consultations(status);
CREATE INDEX idx_consultations_room ON consultations(room_id) WHERE room_id IS NOT NULL;

-- ======================== PRESCRIPTIONS ========================

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  prescription_number VARCHAR(20) UNIQUE,

  consultation_id UUID NOT NULL REFERENCES consultations(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),

  diagnosis TEXT[],

  medications JSONB NOT NULL,

  diet_advice TEXT,
  lifestyle_advice TEXT,
  general_instructions TEXT,

  lab_tests TEXT[],
  imaging_tests TEXT[],

  valid_until DATE,

  is_digital BOOLEAN DEFAULT true,
  is_downloaded BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,

  medicine_ordered BOOLEAN DEFAULT false,
  medicine_order_id UUID,  -- FK added in 007_pharmacy

  pdf_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX idx_prescriptions_created ON prescriptions(created_at DESC);

-- ======================== RATINGS ========================

CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES users(id),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  hospital_id UUID NOT NULL REFERENCES hospitals(id),

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  doctor_rating INTEGER CHECK (doctor_rating >= 1 AND doctor_rating <= 5),
  hospital_rating INTEGER CHECK (hospital_rating >= 1 AND hospital_rating <= 5),
  wait_time_rating INTEGER CHECK (wait_time_rating >= 1 AND wait_time_rating <= 5),

  is_visible BOOLEAN DEFAULT true,
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(appointment_id, patient_id)
);

CREATE INDEX idx_ratings_doctor ON ratings(doctor_id, is_visible);
CREATE INDEX idx_ratings_hospital ON ratings(hospital_id, is_visible);
CREATE INDEX idx_ratings_patient ON ratings(patient_id);
CREATE INDEX idx_ratings_created ON ratings(created_at DESC);

-- ======================== HEALTH DOCUMENTS ========================

CREATE TABLE health_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),

  document_type document_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),

  document_date DATE,
  hospital_name VARCHAR(255),
  doctor_name VARCHAR(255),

  appointment_id UUID REFERENCES appointments(id),
  consultation_id UUID REFERENCES consultations(id),

  is_shared BOOLEAN DEFAULT false,
  shared_doctors UUID[],

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_patient ON health_documents(patient_id);
CREATE INDEX idx_documents_type ON health_documents(patient_id, document_type);
CREATE INDEX idx_documents_family ON health_documents(family_member_id) WHERE family_member_id IS NOT NULL;

-- ======================== APPOINTMENT ATTACHMENTS ========================

CREATE TABLE appointment_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,

  description TEXT,
  uploaded_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointment_attachments ON appointment_attachments(appointment_id);

-- ======================== PATIENT VITALS ========================

CREATE TABLE patient_vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  consultation_id UUID REFERENCES consultations(id),

  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  pulse_rate INTEGER
    CONSTRAINT chk_vitals_pulse CHECK (pulse_rate BETWEEN 20 AND 300),
  temperature DECIMAL(4,1)
    CONSTRAINT chk_vitals_temp CHECK (temperature BETWEEN 30.0 AND 45.0),
  weight DECIMAL(5,2)
    CONSTRAINT chk_vitals_weight CHECK (weight > 0),
  height DECIMAL(5,2)
    CONSTRAINT chk_vitals_height CHECK (height > 0),
  spo2 INTEGER
    CONSTRAINT chk_vitals_spo2 CHECK (spo2 BETWEEN 0 AND 100),
  blood_sugar_fasting DECIMAL(5,1),
  blood_sugar_pp DECIMAL(5,1),

  bmi DECIMAL(4,1),

  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vitals_patient ON patient_vitals(patient_id);
CREATE INDEX idx_vitals_consultation ON patient_vitals(consultation_id) WHERE consultation_id IS NOT NULL;
CREATE INDEX idx_vitals_date ON patient_vitals(patient_id, recorded_at DESC);

-- ======================== MEDICATION REMINDERS ========================

CREATE TABLE medication_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES family_members(id),
  prescription_id UUID REFERENCES prescriptions(id),

  medicine_id UUID,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  instructions TEXT,

  frequency VARCHAR(50) NOT NULL,
  reminder_times TIME[] NOT NULL,
  meal_timing VARCHAR(20),

  start_date DATE NOT NULL,
  end_date DATE,

  is_active BOOLEAN DEFAULT true,

  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_patient ON medication_reminders(patient_id);
CREATE INDEX idx_reminders_active ON medication_reminders(patient_id, is_active) WHERE is_active = true;
CREATE INDEX idx_reminders_prescription ON medication_reminders(prescription_id) WHERE prescription_id IS NOT NULL;

-- ======================== MEDICATION LOGS ========================

CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  reminder_id UUID NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id),

  scheduled_time TIMESTAMPTZ NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  taken_at TIMESTAMPTZ,
  skipped_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_med_logs_reminder ON medication_logs(reminder_id);
CREATE INDEX idx_med_logs_patient ON medication_logs(patient_id, scheduled_time);
CREATE INDEX idx_med_logs_status ON medication_logs(patient_id, status, scheduled_time);

-- ======================== APPOINTMENT WAITLIST ========================

CREATE TABLE appointment_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,

  consultation_type consultation_type NOT NULL DEFAULT 'in_person',
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,

  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CONSTRAINT chk_waitlist_status CHECK (status IN ('waiting', 'notified', 'booked', 'expired', 'cancelled')),

  notified_at TIMESTAMPTZ,
  booked_appointment_id UUID REFERENCES appointments(id),
  expires_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX idx_waitlist_doctor_date ON appointment_waitlist(doctor_id, preferred_date, status);
CREATE INDEX idx_waitlist_status ON appointment_waitlist(status) WHERE status = 'waiting';

-- ======================== PERFORMANCE INDEXES (I9) ========================

-- appointments.patient_id — patient's appointment history (covers scope filters)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON appointments (patient_id);

-- appointments.doctor_id — doctor's appointment queue
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id
  ON appointments (doctor_id);

-- appointments.hospital_id — hospital reception queue
CREATE INDEX IF NOT EXISTS idx_appointments_hospital_id
  ON appointments (hospital_id);

-- appointments.scheduled_date — date-range filtering (today's queue, trends)
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date
  ON appointments (scheduled_date);

-- appointment_waitlist — waiting list lookups by doctor + date (filtered)
CREATE INDEX IF NOT EXISTS idx_waitlist_doctor_date_status
  ON appointment_waitlist (doctor_id, preferred_date)
  WHERE status = 'waiting';

-- ======================== ATOMIC BOOKING RPC (C3) ========================
-- Prevents race conditions in appointment slot booking by performing
-- availability check + insert in a single serializable transaction.

CREATE OR REPLACE FUNCTION book_appointment_atomic(
    p_patient_id UUID,
    p_doctor_id UUID,
    p_hospital_id UUID,
    p_family_member_id UUID,
    p_slot_id UUID,
    p_scheduled_date DATE,
    p_scheduled_start TIMESTAMPTZ,
    p_scheduled_end TIMESTAMPTZ,
    p_consultation_type consultation_type,
    p_patient_notes TEXT,
    p_consultation_fee DECIMAL(12,2),
    p_platform_fee DECIMAL(12,2),
    p_total_amount DECIMAL(12,2)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_appointment_id UUID;
    v_existing_count INTEGER;
    v_pending_count INTEGER;
BEGIN
    -- 1. Lock-check: any confirmed appointment in this slot?
    SELECT COUNT(*) INTO v_existing_count
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND scheduled_date = p_scheduled_date
      AND scheduled_start = p_scheduled_start
      AND status IN ('confirmed', 'checked_in', 'in_progress', 'rescheduled')
    FOR UPDATE;

    IF v_existing_count > 0 THEN
        RAISE EXCEPTION 'SLOT_ALREADY_BOOKED: Slot already booked';
    END IF;

    -- 2. Check for active pending_payment (not timed out - within 30 min)
    SELECT COUNT(*) INTO v_pending_count
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND scheduled_date = p_scheduled_date
      AND scheduled_start = p_scheduled_start
      AND status = 'pending_payment'
      AND created_at > (NOW() - INTERVAL '30 minutes')
    FOR UPDATE;

    IF v_pending_count > 0 THEN
        RAISE EXCEPTION 'SLOT_BEING_BOOKED: Slot is currently being booked by another patient';
    END IF;

    -- 3. If slot_id provided, check capacity
    IF p_slot_id IS NOT NULL THEN
        PERFORM 1 FROM appointment_slots
        WHERE id = p_slot_id
          AND current_bookings < max_bookings
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SLOT_AT_CAPACITY: Slot is at full capacity';
        END IF;

        -- Increment booking count
        UPDATE appointment_slots
        SET current_bookings = current_bookings + 1
        WHERE id = p_slot_id;
    END IF;

    -- 4. Insert appointment atomically
    INSERT INTO appointments (
        patient_id,
        doctor_id,
        hospital_id,
        family_member_id,
        slot_id,
        scheduled_date,
        scheduled_start,
        scheduled_end,
        consultation_type,
        status,
        patient_notes,
        consultation_fee,
        platform_fee,
        total_amount
    ) VALUES (
        p_patient_id,
        p_doctor_id,
        p_hospital_id,
        p_family_member_id,
        p_slot_id,
        p_scheduled_date,
        p_scheduled_start,
        p_scheduled_end,
        p_consultation_type,
        'pending_payment',
        p_patient_notes,
        p_consultation_fee,
        p_platform_fee,
        p_total_amount
    )
    RETURNING id INTO v_appointment_id;

    RETURN v_appointment_id;
END;
$$;
