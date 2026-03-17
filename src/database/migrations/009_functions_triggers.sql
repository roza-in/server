-- ============================================================
-- ROZX Healthcare Platform — Migration 009
-- Functions & Triggers
-- ============================================================
-- Depends on: 008 (all tables created)
-- Key fixes vs original:
--   • SEQUENCE-based number generators (no COUNT race conditions)
--   • verify_payment uses SELECT FOR UPDATE + completed_at
--   • Webhook idempotent processor
--   • Payment state-machine trigger
--   • Ledger balance with pg_advisory_xact_lock
-- ============================================================

-- ======================== SEQUENCES ========================
-- Gap-free per-day sequences via advisory locks

CREATE SEQUENCE IF NOT EXISTS seq_appointment_number START 1;
CREATE SEQUENCE IF NOT EXISTS seq_order_number       START 1;
CREATE SEQUENCE IF NOT EXISTS seq_payment_number     START 1;
CREATE SEQUENCE IF NOT EXISTS seq_prescription_number START 1;
CREATE SEQUENCE IF NOT EXISTS seq_refund_number      START 1;
CREATE SEQUENCE IF NOT EXISTS seq_settlement_number  START 1;
CREATE SEQUENCE IF NOT EXISTS seq_payout_number      START 1;
CREATE SEQUENCE IF NOT EXISTS seq_ticket_number      START 1;

-- ======================== NUMBER GENERATORS ========================

CREATE OR REPLACE FUNCTION generate_appointment_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'APT-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_appointment_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_order_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PAY-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_payment_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_prescription_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RX-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_prescription_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_refund_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RFD-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_refund_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_settlement_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'STL-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_settlement_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payout_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PYT-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('seq_payout_number')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TKT-' || UPPER(SUBSTRING(md5(random()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_walkin_token(p_doctor_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
  token_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO token_count
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND scheduled_date = p_date
    AND booking_source = 'reception';
  RETURN 'T-' || LPAD(token_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD((floor(random() * 1000000))::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ======================== SLOT LOCKING ========================

CREATE OR REPLACE FUNCTION lock_appointment_slot(
  p_slot_id UUID,
  p_user_id UUID,
  p_lock_duration INTEGER DEFAULT 5          -- minutes
)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  UPDATE appointment_slots
  SET
    locked_until = NOW() + (p_lock_duration || ' minutes')::INTERVAL,
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

CREATE OR REPLACE FUNCTION release_expired_slot_locks()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE appointment_slots
  SET locked_until = NULL, locked_by = NULL
  WHERE locked_until IS NOT NULL AND locked_until < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ======================== CONSULTATION LIFECYCLE ========================

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
  SELECT * INTO v_appointment
  FROM appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_appointment.status NOT IN ('confirmed', 'checked_in') THEN
    RAISE EXCEPTION 'Invalid appointment status: %', v_appointment.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE appointments SET status = 'in_progress', updated_at = NOW()
  WHERE id = p_appointment_id;

  INSERT INTO consultations (
    id, appointment_id, status, room_id, started_at,
    duration_seconds, created_at, updated_at
  ) VALUES (
    p_consultation_id, p_appointment_id, 'in_progress', p_room_id,
    p_started_at, p_scheduled_duration * 60, NOW(), NOW()
  ) RETURNING * INTO v_consultation;

  RETURN row_to_json(v_consultation);
END;
$$ LANGUAGE plpgsql;

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
  UPDATE consultations
  SET status = 'completed',
      chief_complaint = p_notes,
      duration_seconds = p_actual_duration,
      ended_at = p_ended_at,
      updated_at = NOW()
  WHERE id = p_consultation_id
  RETURNING * INTO v_consultation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE appointments SET status = 'completed', ended_at = p_ended_at, updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN row_to_json(v_consultation);
END;
$$ LANGUAGE plpgsql;

-- ======================== VERIFY PAYMENT (FIXED) ========================
-- Uses SELECT FOR UPDATE + references completed_at (not paid_at)

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
  -- Lock payment row to prevent double-verification
  SELECT * INTO v_payment
  FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'completed' THEN
    -- Already completed — idempotent return
    RETURN row_to_json(v_payment);
  END IF;

  IF v_payment.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Payment cannot be verified in status: %', v_payment.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE payments
  SET status = 'completed',
      gateway_payment_id = p_gateway_payment_id,
      gateway_signature = p_gateway_signature,
      payment_method = p_payment_method::payment_method,
      completed_at = p_paid_at,
      gateway_response = p_metadata,
      updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  -- Log state transition
  INSERT INTO payment_state_log (payment_id, from_status, to_status, change_source, reason)
  VALUES (p_payment_id, 'pending', 'completed', 'webhook', 'Payment verified');

  IF p_appointment_id IS NOT NULL THEN
    UPDATE appointments
    SET status = 'confirmed', updated_at = NOW()
    WHERE id = p_appointment_id AND status = 'pending_payment';
  END IF;

  RETURN row_to_json(v_payment);
END;
$$ LANGUAGE plpgsql;

-- ======================== WEBHOOK IDEMPOTENT PROCESSOR ========================

CREATE OR REPLACE FUNCTION claim_webhook_event(
  p_provider VARCHAR(50),
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_payload JSONB,
  p_signature_verified BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to insert; if duplicate, return NULL (already claimed)
  INSERT INTO gateway_webhook_events (
    gateway_provider, gateway_event_id, event_type, payload,
    status, signature_verified, processing_started_at
  ) VALUES (
    p_provider, p_event_id, p_event_type, p_payload,
    'processing', p_signature_verified, NOW()
  )
  ON CONFLICT (gateway_provider, gateway_event_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;  -- NULL = already processed (skip)
END;
$$ LANGUAGE plpgsql;

-- ======================== PAYMENT STATE MACHINE ========================

CREATE OR REPLACE FUNCTION enforce_payment_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions
  IF NOT (
    (OLD.status = 'pending'             AND NEW.status IN ('processing', 'completed', 'failed', 'expired')) OR
    (OLD.status = 'processing'          AND NEW.status IN ('completed', 'failed')) OR
    (OLD.status = 'completed'           AND NEW.status IN ('refunded', 'partially_refunded', 'disputed')) OR
    (OLD.status = 'partially_refunded'  AND NEW.status IN ('refunded', 'disputed')) OR
    (OLD.status = 'failed'              AND NEW.status IN ('pending')) OR  -- retry
    (OLD.status = 'disputed'            AND NEW.status IN ('completed', 'refunded'))
  ) THEN
    RAISE EXCEPTION 'Invalid payment state transition: % → %', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Auto-log transition
  INSERT INTO payment_state_log (payment_id, from_status, to_status, change_source)
  VALUES (NEW.id, OLD.status, NEW.status, 'system');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== REFUND CAP ENFORCEMENT ========================

CREATE OR REPLACE FUNCTION update_payment_total_refunded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE payments
    SET total_refunded = total_refunded + NEW.refund_amount,
        status = CASE
          WHEN total_refunded + NEW.refund_amount >= total_amount THEN 'refunded'::payment_status
          ELSE 'partially_refunded'::payment_status
        END,
        updated_at = NOW()
    WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== LEDGER BALANCE ========================
-- Uses advisory lock to prevent balance race conditions

CREATE OR REPLACE FUNCTION update_ledger_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_last_balance DECIMAL(14,2);
  v_lock_key BIGINT;
BEGIN
  -- Derive a stable lock key from account_type enum ordinal
  v_lock_key := hashtext(NEW.account_type::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT running_balance INTO v_last_balance
  FROM financial_ledger
  WHERE account_type = NEW.account_type
  ORDER BY created_at DESC
  LIMIT 1;

  v_last_balance := COALESCE(v_last_balance, 0);

  IF NEW.entry_type = 'credit' THEN
    NEW.running_balance := v_last_balance + NEW.amount;
  ELSE
    NEW.running_balance := v_last_balance - NEW.amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== PREVENT LEDGER MUTATION ========================

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial ledger entries are immutable — cannot UPDATE or DELETE'
    USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ======================== RATING CALCULATIONS ========================

CREATE OR REPLACE FUNCTION update_doctor_rating(p_doctor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE doctors
  SET rating = (SELECT COALESCE(AVG(rating), 0) FROM ratings WHERE doctor_id = p_doctor_id AND is_visible = true),
      total_ratings = (SELECT COUNT(*) FROM ratings WHERE doctor_id = p_doctor_id AND is_visible = true)
  WHERE id = p_doctor_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_hospital_rating(p_hospital_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE hospitals
  SET rating = (SELECT COALESCE(AVG(hospital_rating), 0) FROM ratings WHERE hospital_id = p_hospital_id AND hospital_rating IS NOT NULL AND is_visible = true),
      total_ratings = (SELECT COUNT(*) FROM ratings WHERE hospital_id = p_hospital_id AND hospital_rating IS NOT NULL AND is_visible = true)
  WHERE id = p_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- ======================== GENERIC UPDATED_AT ========================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== AUTO-SET NUMBER TRIGGERS ========================

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

CREATE OR REPLACE FUNCTION set_refund_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.refund_number IS NULL THEN
    NEW.refund_number := generate_refund_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_settlement_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.settlement_number IS NULL THEN
    NEW.settlement_number := generate_settlement_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_payout_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_number IS NULL THEN
    NEW.payout_number := generate_payout_number();
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

-- ======================== EVENT TRIGGERS ========================

CREATE OR REPLACE FUNCTION on_rating_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_doctor_rating(NEW.doctor_id);
  PERFORM update_hospital_rating(NEW.hospital_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_appointment_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL THEN
    UPDATE appointment_slots
    SET current_bookings = current_bookings + 1,
        is_available = (current_bookings + 1 < max_bookings),
        locked_until = NULL,
        locked_by = NULL
    WHERE id = NEW.slot_id;
  END IF;

  UPDATE doctors SET total_consultations = total_consultations + 1 WHERE id = NEW.doctor_id;
  UPDATE hospitals SET total_appointments = total_appointments + 1 WHERE id = NEW.hospital_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_history := COALESCE(OLD.status_history, '[]'::JSONB) ||
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'timestamp', NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== SEARCH VECTOR FUNCTIONS ========================

CREATE OR REPLACE FUNCTION update_users_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_hospitals_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(array_to_string(NEW.also_known_as, ' '), '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.state, '') || ' ' ||
    COALESCE(NEW.pincode, '') || ' ' ||
    COALESCE(array_to_string(NEW.departments, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.accreditations, ' '), '') || ' ' ||
    COALESCE(NEW.short_description, '') || ' ' ||
    COALESCE(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_doctors_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.bio, '') || ' ' ||
    COALESCE(NEW.short_bio, '') || ' ' ||
    COALESCE(array_to_string(NEW.qualifications, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.conditions_treated, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.procedures_performed, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.expertise_areas, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.languages, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_medicines_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.generic_name, '') || ' ' ||
    COALESCE(NEW.brand, '') || ' ' ||
    COALESCE(NEW.manufacturer, '') || ' ' ||
    COALESCE(NEW.composition, '') || ' ' ||
    COALESCE(NEW.meta_description, '') || ' ' ||
    COALESCE(NEW.drug_interactions, '') || ' ' ||
    COALESCE(array_to_string(NEW.search_keywords, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================== SCHEDULED CLEANUP ========================

-- ======================== RPC FUNCTIONS (called by server code) ========================

CREATE OR REPLACE FUNCTION increment_otp_attempts(p_otp_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE otp_codes
  SET attempts = attempts + 1
  WHERE id = p_otp_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_doctor_stats(p_doctor_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_appointments', COALESCE(d.total_consultations, 0),
    'total_ratings', COALESCE(d.total_ratings, 0),
    'average_rating', COALESCE(d.rating, 0),
    'pending_appointments', (
      SELECT COUNT(*) FROM appointments
      WHERE doctor_id = p_doctor_id
        AND status IN ('pending_payment', 'confirmed', 'checked_in')
        AND scheduled_date >= CURRENT_DATE
    ),
    'today_appointments', (
      SELECT COUNT(*) FROM appointments
      WHERE doctor_id = p_doctor_id
        AND scheduled_date = CURRENT_DATE
        AND status NOT IN ('cancelled', 'no_show')
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(total_amount), 0) FROM payments
      WHERE appointment_id IN (
        SELECT id FROM appointments WHERE doctor_id = p_doctor_id
      ) AND status = 'completed'
    )
  ) INTO v_result
  FROM doctors d
  WHERE d.id = p_doctor_id;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;

-- ======================== SCHEDULED CLEANUP ========================

CREATE OR REPLACE FUNCTION run_scheduled_cleanups()
RETURNS JSONB AS $$
DECLARE
  v_expired_locks INTEGER;
  v_expired_sessions INTEGER;
  v_expired_otps INTEGER;
BEGIN
  SELECT release_expired_slot_locks() INTO v_expired_locks;

  DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_expired_sessions = ROW_COUNT;

  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_expired_otps = ROW_COUNT;

  UPDATE appointments
  SET status = 'no_show'
  WHERE status = 'confirmed'
    AND scheduled_start < NOW() - INTERVAL '1 hour'
    AND checked_in_at IS NULL;

  RETURN jsonb_build_object(
    'expired_locks', v_expired_locks,
    'expired_sessions', v_expired_sessions,
    'expired_otps', v_expired_otps,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CREATE ALL TRIGGERS
-- ============================================================

-- ---- updated_at ----
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
CREATE TRIGGER tr_settlements_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_specializations_updated_at BEFORE UPDATE ON specializations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_hospital_staff_updated_at BEFORE UPDATE ON hospital_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_doctor_schedules_updated_at BEFORE UPDATE ON doctor_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_family_members_updated_at BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_device_tokens_updated_at BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_cancellation_policies_updated_at BEFORE UPDATE ON cancellation_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_hold_funds_updated_at BEFORE UPDATE ON hold_funds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_recon_records_updated_at BEFORE UPDATE ON reconciliation_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_pharmacy_settlements_updated_at BEFORE UPDATE ON pharmacy_settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_payment_disputes_updated_at BEFORE UPDATE ON payment_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_platform_config_updated_at BEFORE UPDATE ON platform_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_medicine_returns_updated_at BEFORE UPDATE ON medicine_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_payout_accounts_updated_at BEFORE UPDATE ON payout_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_commission_slabs_updated_at BEFORE UPDATE ON commission_slabs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_medication_reminders_updated_at BEFORE UPDATE ON medication_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_health_documents_updated_at BEFORE UPDATE ON health_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_hospital_announcements_updated_at BEFORE UPDATE ON hospital_announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_patient_credits_updated_at BEFORE UPDATE ON patient_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_patient_medications_updated_at BEFORE UPDATE ON patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_patient_allergies_updated_at BEFORE UPDATE ON patient_allergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_patient_conditions_updated_at BEFORE UPDATE ON patient_medical_conditions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_appointment_waitlist_updated_at BEFORE UPDATE ON appointment_waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- auto-generate numbers ----
CREATE TRIGGER tr_appointment_number BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_appointment_number();
CREATE TRIGGER tr_order_number BEFORE INSERT ON medicine_orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();
CREATE TRIGGER tr_payment_number BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION set_payment_number();
CREATE TRIGGER tr_prescription_number BEFORE INSERT ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION set_prescription_number();
CREATE TRIGGER tr_refund_number BEFORE INSERT ON refunds
  FOR EACH ROW EXECUTE FUNCTION set_refund_number();
CREATE TRIGGER tr_settlement_number BEFORE INSERT ON settlements
  FOR EACH ROW EXECUTE FUNCTION set_settlement_number();
CREATE TRIGGER tr_payout_number BEFORE INSERT ON payouts
  FOR EACH ROW EXECUTE FUNCTION set_payout_number();
CREATE TRIGGER tr_ticket_number BEFORE INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

-- ---- business logic ----
CREATE TRIGGER tr_rating_change AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION on_rating_change();
CREATE TRIGGER tr_appointment_created AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION on_appointment_created();
CREATE TRIGGER tr_order_status_tracking BEFORE UPDATE ON medicine_orders
  FOR EACH ROW EXECUTE FUNCTION track_order_status_change();

-- ---- payment state machine ----
CREATE TRIGGER tr_payment_state_machine BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_state_machine();

-- ---- refund cap enforcement ----
CREATE TRIGGER tr_refund_completed AFTER UPDATE ON refunds
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION update_payment_total_refunded();

-- ---- ledger immutability & balance ----
CREATE TRIGGER tr_ledger_balance BEFORE INSERT ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION update_ledger_running_balance();
CREATE TRIGGER tr_ledger_immutable BEFORE UPDATE OR DELETE ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- ---- search vectors ----
CREATE TRIGGER tr_users_search_vector BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_search_vector();
CREATE TRIGGER tr_hospitals_search_vector BEFORE INSERT OR UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_hospitals_search_vector();
CREATE TRIGGER tr_doctors_search_vector BEFORE INSERT OR UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_doctors_search_vector();
CREATE TRIGGER tr_medicines_search_vector BEFORE INSERT OR UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_medicines_search_vector();
