-- ============================================================
-- ROZX Healthcare Platform - Migration 008
-- PostgreSQL Functions and Stored Procedures
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BOOKING ID GENERATION
-- ============================================================

-- Function: Generate unique booking ID (RZX + 7 alphanumeric chars)
CREATE OR REPLACE FUNCTION generate_booking_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'RZX';
  i INTEGER;
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    result := 'RZX';
    FOR i IN 1..7 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if ID already exists
    SELECT EXISTS(SELECT 1 FROM appointments WHERE booking_id = result) INTO id_exists;
    
    IF NOT id_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate prescription number
CREATE OR REPLACE FUNCTION generate_prescription_number(p_hospital_id UUID)
RETURNS TEXT AS $$
DECLARE
  hospital_code VARCHAR(10);
  current_year TEXT;
  seq_num INTEGER;
  result TEXT;
BEGIN
  -- Get hospital code (first 3 letters of slug)
  SELECT UPPER(LEFT(slug, 3)) INTO hospital_code
  FROM hospitals WHERE id = p_hospital_id;
  
  IF hospital_code IS NULL THEN
    hospital_code := 'GEN';
  END IF;
  
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this hospital this year
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(prescription_number, '/', 4) AS INTEGER)
  ), 0) + 1 INTO seq_num
  FROM prescriptions
  WHERE hospital_id = p_hospital_id
    AND prescription_number LIKE 'ROZX/' || hospital_code || '/' || current_year || '/%';
  
  result := 'ROZX/' || hospital_code || '/' || current_year || '/' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_type VARCHAR)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  current_year TEXT;
  seq_num INTEGER;
  result TEXT;
BEGIN
  prefix := CASE p_type
    WHEN 'patient' THEN 'INV'
    WHEN 'hospital' THEN 'HINV'
    WHEN 'settlement' THEN 'SINV'
    ELSE 'INV'
  END;
  
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(invoice_number, '/', 3) AS INTEGER)
  ), 0) + 1 INTO seq_num
  FROM invoices
  WHERE invoice_type = p_type
    AND invoice_number LIKE 'ROZX/' || prefix || '/' || current_year || '/%';
  
  result := 'ROZX/' || prefix || '/' || current_year || '/' || LPAD(seq_num::TEXT, 6, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(ticket_number, '-', 3) AS INTEGER)
  ), 0) + 1 INTO seq_num
  FROM support_tickets;
  
  result := 'ROZX-SUPPORT-' || LPAD(seq_num::TEXT, 5, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RATING CALCULATION FUNCTIONS
-- ============================================================

-- Function: Update doctor's average rating
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_count INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(overall_rating)::DECIMAL(3,2), 0),
    COUNT(*)::INTEGER
  INTO avg_rating, total_count
  FROM ratings 
  WHERE doctor_id = COALESCE(NEW.doctor_id, OLD.doctor_id)
    AND is_visible = true;
  
  UPDATE doctors
  SET 
    rating = avg_rating,
    total_ratings = total_count
  WHERE id = COALESCE(NEW.doctor_id, OLD.doctor_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Update hospital's average rating
CREATE OR REPLACE FUNCTION update_hospital_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_count INTEGER;
  hospital_id_val UUID;
BEGIN
  hospital_id_val := COALESCE(NEW.hospital_id, OLD.hospital_id);
  
  IF hospital_id_val IS NOT NULL THEN
    SELECT 
      COALESCE(AVG(COALESCE(hospital_rating, overall_rating))::DECIMAL(3,2), 0),
      COUNT(*)::INTEGER
    INTO avg_rating, total_count
    FROM ratings 
    WHERE hospital_id = hospital_id_val
      AND is_visible = true;
    
    UPDATE hospitals
    SET 
      rating = avg_rating,
      total_ratings = total_count
    WHERE id = hospital_id_val;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CONSULTATION COUNTER FUNCTIONS
-- ============================================================

-- Function: Increment doctor consultation count
CREATE OR REPLACE FUNCTION increment_doctor_consultations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE doctors
    SET total_consultations = total_consultations + 1
    WHERE id = NEW.doctor_id;
    
    IF NEW.hospital_id IS NOT NULL THEN
      UPDATE hospitals
      SET total_consultations = total_consultations + 1
      WHERE id = NEW.hospital_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SLOT AVAILABILITY FUNCTIONS
-- ============================================================

-- Function: Check if slot is available
CREATE OR REPLACE FUNCTION is_slot_available(
  p_doctor_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_consultation_type consultation_type
)
RETURNS BOOLEAN AS $$
DECLARE
  is_available BOOLEAN;
  has_override BOOLEAN;
  override_is_available BOOLEAN;
  has_existing_booking BOOLEAN;
BEGIN
  -- Check if there's a schedule override for this date
  SELECT EXISTS(
    SELECT 1 FROM schedule_overrides
    WHERE doctor_id = p_doctor_id
      AND override_date = p_date
  ) INTO has_override;
  
  IF has_override THEN
    SELECT is_available INTO override_is_available
    FROM schedule_overrides
    WHERE doctor_id = p_doctor_id
      AND override_date = p_date;
    
    IF NOT override_is_available THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check if doctor has regular schedule for this day
  SELECT EXISTS(
    SELECT 1 FROM doctor_schedules
    WHERE doctor_id = p_doctor_id
      AND day_of_week = LOWER(TO_CHAR(p_date, 'day'))::day_of_week
      AND is_active = true
      AND start_time <= p_start_time
      AND end_time >= p_end_time
      AND (
        p_consultation_type = ANY(consultation_types)
        OR consultation_types IS NULL
      )
  ) INTO is_available;
  
  IF NOT is_available AND NOT has_override THEN
    RETURN FALSE;
  END IF;
  
  -- Check for existing bookings at this time
  SELECT EXISTS(
    SELECT 1 FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
      AND (
        (start_time < p_end_time AND end_time > p_start_time)
      )
  ) INTO has_existing_booking;
  
  RETURN NOT has_existing_booking;
END;
$$ LANGUAGE plpgsql;

-- Function: Get available slots for a doctor on a date
CREATE OR REPLACE FUNCTION get_available_slots(
  p_doctor_id UUID,
  p_date DATE,
  p_consultation_type consultation_type DEFAULT 'in_person'
)
RETURNS TABLE (
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN
) AS $$
DECLARE
  schedule RECORD;
  slot_duration INTEGER;
  curr_time TIME;
  slot_end TIME;
BEGIN
  -- Get the schedule for this day
  SELECT * INTO schedule
  FROM doctor_schedules ds
  WHERE ds.doctor_id = p_doctor_id
    AND ds.day_of_week = LOWER(TRIM(TO_CHAR(p_date, 'day')))::day_of_week
    AND ds.is_active = true
    AND (
      p_consultation_type = ANY(ds.consultation_types)
      OR ds.consultation_types IS NULL
    )
  LIMIT 1;
  
  IF schedule IS NULL THEN
    RETURN;
  END IF;
  
  slot_duration := COALESCE(schedule.slot_duration, 15);
  curr_time := schedule.start_time;
  
  WHILE curr_time < schedule.end_time LOOP
    slot_end := curr_time + (slot_duration || ' minutes')::interval;
    
    -- Skip break time
    IF schedule.break_start IS NOT NULL AND schedule.break_end IS NOT NULL THEN
      IF curr_time >= schedule.break_start AND curr_time < schedule.break_end THEN
        curr_time := schedule.break_end;
        CONTINUE;
      END IF;
    END IF;
    
    start_time := curr_time;
    end_time := slot_end;
    is_available := is_slot_available(p_doctor_id, p_date, curr_time, slot_end, p_consultation_type);
    
    RETURN NEXT;
    
    curr_time := slot_end + (COALESCE(schedule.buffer_time, 0) || ' minutes')::interval;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REFUND CALCULATION FUNCTION
-- ============================================================

-- Function: Calculate refund amount based on cancellation policy
CREATE OR REPLACE FUNCTION calculate_refund(
  p_appointment_id UUID,
  p_cancelled_by_type VARCHAR  -- 'patient', 'doctor', 'hospital', 'system'
)
RETURNS TABLE (
  refund_type refund_type,
  refund_percentage DECIMAL(5,2),
  refund_amount DECIMAL(10,2),
  credit_amount DECIMAL(10,2)
) AS $$
DECLARE
  appointment RECORD;
  payment RECORD;
  hours_until_appointment DECIMAL;
BEGIN
  -- Get appointment details
  SELECT * INTO appointment
  FROM appointments
  WHERE id = p_appointment_id;
  
  -- Get payment details
  SELECT * INTO payment
  FROM payments
  WHERE appointment_id = p_appointment_id
    AND status = 'completed';
  
  IF payment IS NULL THEN
    refund_type := 'none';
    refund_percentage := 0;
    refund_amount := 0;
    credit_amount := 0;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Calculate hours until appointment
  hours_until_appointment := EXTRACT(EPOCH FROM (
    (appointment.appointment_date + appointment.start_time) - NOW()
  )) / 3600;
  
  -- Determine refund type based on cancellation policy
  IF p_cancelled_by_type IN ('doctor', 'hospital') THEN
    -- Doctor/hospital cancelled: 100% refund + credit
    refund_type := 'doctor_cancelled';
    refund_percentage := 100;
    refund_amount := payment.amount;
    credit_amount := 50;  -- ₹50 apology credit
  ELSIF p_cancelled_by_type = 'system' THEN
    -- Technical failure: 100% refund + free consultation credit
    refund_type := 'technical_failure';
    refund_percentage := 100;
    refund_amount := payment.amount;
    credit_amount := payment.amount;  -- Credit for free consultation
  ELSIF hours_until_appointment > 24 THEN
    -- >24 hours: 100% refund
    refund_type := 'full';
    refund_percentage := 100;
    refund_amount := payment.amount;
    credit_amount := 0;
  ELSIF hours_until_appointment > 12 THEN
    -- 12-24 hours: 75% refund
    refund_type := 'partial_75';
    refund_percentage := 75;
    refund_amount := payment.amount * 0.75;
    credit_amount := 0;
  ELSIF hours_until_appointment > 0 THEN
    -- <12 hours: 50% refund
    refund_type := 'partial_50';
    refund_percentage := 50;
    refund_amount := payment.amount * 0.50;
    credit_amount := 0;
  ELSE
    -- Already passed: No refund
    refund_type := 'none';
    refund_percentage := 0;
    refund_amount := 0;
    credit_amount := 0;
  END IF;
  
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ANALYTICS FUNCTIONS
-- ============================================================

-- Function: Get hospital dashboard stats
CREATE OR REPLACE FUNCTION get_hospital_stats(
  p_hospital_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_appointments INTEGER,
  completed_appointments INTEGER,
  cancelled_appointments INTEGER,
  no_show_appointments INTEGER,
  online_consultations INTEGER,
  in_person_consultations INTEGER,
  total_revenue DECIMAL(12,2),
  platform_fees DECIMAL(12,2),
  net_revenue DECIMAL(12,2),
  unique_patients INTEGER,
  new_patients INTEGER,
  returning_patients INTEGER,
  avg_rating DECIMAL(3,2)
) AS $$
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'no_show')::INTEGER,
    COUNT(*) FILTER (WHERE consultation_type = 'online')::INTEGER,
    COUNT(*) FILTER (WHERE consultation_type = 'in_person')::INTEGER
  INTO 
    total_appointments,
    completed_appointments,
    cancelled_appointments,
    no_show_appointments,
    online_consultations,
    in_person_consultations
  FROM appointments
  WHERE hospital_id = p_hospital_id
    AND appointment_date BETWEEN p_start_date AND p_end_date;
  
  SELECT
    COALESCE(SUM(amount), 0)::DECIMAL(12,2),
    COALESCE(SUM(platform_fee), 0)::DECIMAL(12,2),
    COALESCE(SUM(amount - platform_fee), 0)::DECIMAL(12,2)
  INTO total_revenue, platform_fees, net_revenue
  FROM payments
  WHERE hospital_id = p_hospital_id
    AND status = 'completed'
    AND paid_at BETWEEN p_start_date AND p_end_date;
  
  SELECT COUNT(DISTINCT patient_id)::INTEGER
  INTO unique_patients
  FROM appointments
  WHERE hospital_id = p_hospital_id
    AND appointment_date BETWEEN p_start_date AND p_end_date;
  
  -- New patients (first appointment with this hospital)
  SELECT COUNT(DISTINCT a.patient_id)::INTEGER
  INTO new_patients
  FROM appointments a
  WHERE a.hospital_id = p_hospital_id
    AND a.appointment_date BETWEEN p_start_date AND p_end_date
    AND NOT EXISTS (
      SELECT 1 FROM appointments a2
      WHERE a2.patient_id = a.patient_id
        AND a2.hospital_id = p_hospital_id
        AND a2.appointment_date < p_start_date
    );
  
  returning_patients := unique_patients - new_patients;
  
  SELECT COALESCE(AVG(overall_rating), 0)::DECIMAL(3,2)
  INTO avg_rating
  FROM ratings
  WHERE hospital_id = p_hospital_id
    AND created_at BETWEEN p_start_date AND p_end_date
    AND is_visible = true;
  
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BMI CALCULATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_bmi(p_weight_kg DECIMAL, p_height_cm INTEGER)
RETURNS DECIMAL(4,1) AS $$
BEGIN
  IF p_weight_kg IS NULL OR p_height_cm IS NULL OR p_height_cm = 0 THEN
    RETURN NULL;
  END IF;
  
  RETURN ROUND((p_weight_kg / ((p_height_cm / 100.0) ^ 2))::DECIMAL, 1);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- END OF MIGRATION 008
-- ============================================================
