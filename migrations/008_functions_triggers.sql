-- ============================================================
-- ROZX Healthcare Platform - Migration 008
-- Functions & Triggers (Supabase Ready)
-- ============================================================

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Generate unique appointment number (APT-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_appointment_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM appointments
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'APT-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate unique order number (ORD-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM medicine_orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'ORD-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate unique payment number (PAY-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM payments
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'PAY-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate unique prescription number (RX-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_prescription_number()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  today_str := to_char(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM prescriptions
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'RX-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate ticket number (TKT-XXXXXX)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'TKT-' || UPPER(SUBSTRING(md5(random()::TEXT) FROM 1 FOR 6));
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate walk-in token (T-XXX)
CREATE OR REPLACE FUNCTION generate_walkin_token(p_doctor_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
  token_count INTEGER;
  new_token TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO token_count
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND scheduled_date = p_date
    AND booking_source = 'reception';
  
  new_token := 'T-' || LPAD(token_count::TEXT, 3, '0');
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Generate 6-digit OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD((floor(random() * 1000000))::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SLOT LOCKING (Race condition prevention)
-- ============================================================

CREATE OR REPLACE FUNCTION lock_appointment_slot(
  p_slot_id UUID,
  p_user_id UUID,
  p_lock_duration_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  UPDATE appointment_slots
  SET 
    locked_until = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL,
    locked_by = p_user_id,
    lock_version = lock_version + 1
  WHERE id = p_slot_id
    AND is_available = true
    AND current_bookings < max_bookings
    AND (locked_until IS NULL OR locked_until < NOW())
  RETURNING true INTO v_locked;
  
  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql;

-- Release expired slot locks
CREATE OR REPLACE FUNCTION release_expired_slot_locks()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE appointment_slots
  SET 
    locked_until = NULL,
    locked_by = NULL
  WHERE locked_until IS NOT NULL
    AND locked_until < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ATOMIC BUSINESS PROCESSES
-- ============================================================

CREATE OR REPLACE FUNCTION start_consultation(
    p_appointment_id UUID,
    p_consultation_id UUID,
    p_doctor_id UUID,
    p_patient_id UUID,
    p_room_id VARCHAR(255),
    p_scheduled_duration INTEGER,
    p_started_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_appointment appointments%ROWTYPE;
    v_consultation consultations%ROWTYPE;
BEGIN
    -- 1. Get and lock appointment for update
    SELECT * INTO v_appointment
    FROM appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Verify status
    IF v_appointment.status NOT IN ('confirmed', 'checked_in') THEN
        RAISE EXCEPTION 'Invalid appointment status: %', v_appointment.status USING ERRCODE = 'P0001';
    END IF;

    -- 3. Update appointment status
    UPDATE appointments
    SET 
        status = 'in_progress',
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 4. Create consultation
    INSERT INTO consultations (
        id,
        appointment_id,
        status,
        room_id,
        started_at,
        duration_seconds,
        created_at,
        updated_at
    ) VALUES (
        p_consultation_id,
        p_appointment_id,
        'in_progress',
        p_room_id,
        p_started_at,
        p_scheduled_duration * 60, -- Convert minutes to seconds
        NOW(),
        NOW()
    )
    RETURNING * INTO v_consultation;

    -- 5. Return the created consultation as JSON
    RETURN row_to_json(v_consultation);
END;
$$ LANGUAGE plpgsql;

-- End consultation and update appointment atomically
CREATE OR REPLACE FUNCTION end_consultation(
    p_consultation_id UUID,
    p_appointment_id UUID,
    p_notes TEXT,
    p_actual_duration INTEGER,
    p_ended_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_consultation consultations%ROWTYPE;
BEGIN
    -- 1. Update consultation
    UPDATE consultations
    SET 
        status = 'completed',
        doctor_notes = p_notes,
        actual_duration = p_actual_duration,
        ended_at = p_ended_at,
        updated_at = NOW()
    WHERE id = p_consultation_id
    RETURNING * INTO v_consultation;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Update appointment
    UPDATE appointments
    SET 
        status = 'completed',
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN row_to_json(v_consultation);
END;
$$ LANGUAGE plpgsql;

-- Verify payment and confirm appointment atomically
CREATE OR REPLACE FUNCTION verify_payment(
    p_payment_id UUID,
    p_appointment_id UUID,
    p_gateway_payment_id TEXT,
    p_gateway_signature TEXT,
    p_payment_method TEXT,
    p_metadata JSONB,
    p_paid_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_payment payments%ROWTYPE;
BEGIN
    -- 1. Update payment status
    UPDATE payments
    SET 
        status = 'completed',
        gateway_payment_id = p_gateway_payment_id,
        gateway_signature = p_gateway_signature,
        payment_method = p_payment_method::payment_method, -- Cast to enum
        paid_at = p_paid_at,
        gateway_response = p_metadata,
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Update appointment status (if linked)
    IF p_appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET 
            status = 'confirmed',
            payment_status = 'completed',
            payment_id = p_payment_id,
            paid_at = p_paid_at,
            updated_at = NOW()
        WHERE id = p_appointment_id;
    END IF;

    RETURN row_to_json(v_payment);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RATING CALCULATIONS
-- ============================================================

-- Update doctor rating
CREATE OR REPLACE FUNCTION update_doctor_rating(p_doctor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE doctors
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM ratings r
      WHERE r.doctor_id = p_doctor_id AND r.is_visible = true
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM ratings r
      WHERE r.doctor_id = p_doctor_id AND r.is_visible = true
    )
  WHERE id = p_doctor_id;
END;
$$ LANGUAGE plpgsql;

-- Update hospital rating
CREATE OR REPLACE FUNCTION update_hospital_rating(p_hospital_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE hospitals
  SET 
    rating = (
      SELECT COALESCE(AVG(hospital_rating), 0)
      FROM ratings r
      WHERE r.hospital_id = p_hospital_id 
        AND r.hospital_rating IS NOT NULL 
        AND r.is_visible = true
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM ratings r
      WHERE r.hospital_id = p_hospital_id 
        AND r.hospital_rating IS NOT NULL 
        AND r.is_visible = true
    )
  WHERE id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTO-GENERATE NUMBERS TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_appointment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.appointment_number IS NULL THEN
    NEW.appointment_number := generate_appointment_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_payment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := generate_payment_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_prescription_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prescription_number IS NULL THEN
    NEW.prescription_number := generate_prescription_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RATING TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION on_rating_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update doctor rating
  PERFORM update_doctor_rating(NEW.doctor_id);
  
  -- Update hospital rating
  PERFORM update_hospital_rating(NEW.hospital_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SLOT BOOKING UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION on_appointment_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment slot booking count
  IF NEW.slot_id IS NOT NULL THEN
    UPDATE appointment_slots
    SET 
      current_bookings = current_bookings + 1,
      is_available = (current_bookings + 1 < max_bookings),
      locked_until = NULL,
      locked_by = NULL
    WHERE id = NEW.slot_id;
  END IF;
  
  -- Update doctor total consultations
  UPDATE doctors
  SET total_consultations = total_consultations + 1
  WHERE id = NEW.doctor_id;
  
  -- Update hospital total appointments
  UPDATE hospitals
  SET total_appointments = total_appointments + 1
  WHERE id = NEW.hospital_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MEDICINE ORDER STATUS HISTORY
-- ============================================================

CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_history := COALESCE(OLD.status_history, '[]'::JSONB) || 
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'timestamp', NOW()
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SCHEDULED CLEANUP JOBS
-- ============================================================

CREATE OR REPLACE FUNCTION run_scheduled_cleanups()
RETURNS JSONB AS $$
DECLARE
  v_expired_locks INTEGER;
  v_expired_sessions INTEGER;
  v_expired_otps INTEGER;
  v_result JSONB;
BEGIN
  -- Release expired slot locks
  SELECT release_expired_slot_locks() INTO v_expired_locks;
  
  -- Clean expired sessions
  DELETE FROM user_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_expired_sessions = ROW_COUNT;
  
  -- Clean expired OTPs
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_expired_otps = ROW_COUNT;
  
  -- Mark no-show appointments
  UPDATE appointments
  SET status = 'no_show'
  WHERE status = 'confirmed'
    AND scheduled_start < NOW() - INTERVAL '1 hour'
    AND checked_in_at IS NULL;
  
  v_result := jsonb_build_object(
    'expired_locks', v_expired_locks,
    'expired_sessions', v_expired_sessions,
    'expired_otps', v_expired_otps,
    'timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CREATE TRIGGERS
-- ============================================================

-- Updated at triggers
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_hospitals_updated_at BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_doctors_updated_at BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_consultations_updated_at BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_prescriptions_updated_at BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_medicine_orders_updated_at BEFORE UPDATE ON medicine_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate number triggers
CREATE TRIGGER tr_appointment_number BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_appointment_number();

CREATE TRIGGER tr_order_number BEFORE INSERT ON medicine_orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

CREATE TRIGGER tr_payment_number BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION set_payment_number();

CREATE TRIGGER tr_prescription_number BEFORE INSERT ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION set_prescription_number();

CREATE TRIGGER tr_ticket_number BEFORE INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

-- Rating trigger
CREATE TRIGGER tr_rating_change AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION on_rating_change();

-- Appointment created trigger
CREATE TRIGGER tr_appointment_created AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION on_appointment_created();

-- Medicine order status tracking
CREATE TRIGGER tr_order_status_tracking BEFORE UPDATE ON medicine_orders
  FOR EACH ROW EXECUTE FUNCTION track_order_status_change();

-- ============================================================
-- SEARCH VECTOR UPDATE FUNCTIONS (Full-text search support)
-- ============================================================

-- Users search vector
CREATE OR REPLACE FUNCTION update_users_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hospitals search vector
CREATE OR REPLACE FUNCTION update_hospitals_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.city, '') || ' ' || 
    COALESCE(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Doctors search vector
CREATE OR REPLACE FUNCTION update_doctors_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.bio, '') || ' ' || 
    COALESCE(array_to_string(NEW.qualifications, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Medicines search vector
CREATE OR REPLACE FUNCTION update_medicines_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.generic_name, '') || ' ' ||
    COALESCE(NEW.brand, '') || ' ' ||
    COALESCE(NEW.manufacturer, '') || ' ' ||
    COALESCE(NEW.composition, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEARCH VECTOR TRIGGERS
-- ============================================================

CREATE TRIGGER tr_users_search_vector BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_search_vector();

CREATE TRIGGER tr_hospitals_search_vector BEFORE INSERT OR UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_hospitals_search_vector();

CREATE TRIGGER tr_doctors_search_vector BEFORE INSERT OR UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_doctors_search_vector();

CREATE TRIGGER tr_medicines_search_vector BEFORE INSERT OR UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_medicines_search_vector();

