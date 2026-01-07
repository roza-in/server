-- ============================================================
-- ROZX Healthcare Platform - Migration 009
-- Database Triggers
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

-- Users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Hospitals
DROP TRIGGER IF EXISTS update_hospitals_updated_at ON hospitals;
CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Doctors
DROP TRIGGER IF EXISTS update_doctors_updated_at ON doctors;
CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Doctor Schedules
DROP TRIGGER IF EXISTS update_doctor_schedules_updated_at ON doctor_schedules;
CREATE TRIGGER update_doctor_schedules_updated_at
  BEFORE UPDATE ON doctor_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Schedule Overrides
DROP TRIGGER IF EXISTS update_schedule_overrides_updated_at ON schedule_overrides;
CREATE TRIGGER update_schedule_overrides_updated_at
  BEFORE UPDATE ON schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Family Members
DROP TRIGGER IF EXISTS update_family_members_updated_at ON family_members;
CREATE TRIGGER update_family_members_updated_at
  BEFORE UPDATE ON family_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Health Documents
DROP TRIGGER IF EXISTS update_health_documents_updated_at ON health_documents;
CREATE TRIGGER update_health_documents_updated_at
  BEFORE UPDATE ON health_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Patient Vitals
DROP TRIGGER IF EXISTS update_patient_vitals_updated_at ON patient_vitals;
CREATE TRIGGER update_patient_vitals_updated_at
  BEFORE UPDATE ON patient_vitals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Medication Reminders
DROP TRIGGER IF EXISTS update_medication_reminders_updated_at ON medication_reminders;
CREATE TRIGGER update_medication_reminders_updated_at
  BEFORE UPDATE ON medication_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Appointments
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Appointment Slots
DROP TRIGGER IF EXISTS update_appointment_slots_updated_at ON appointment_slots;
CREATE TRIGGER update_appointment_slots_updated_at
  BEFORE UPDATE ON appointment_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Consultations
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prescriptions
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Refunds
DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
CREATE TRIGGER update_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Hospital Settlements
DROP TRIGGER IF EXISTS update_hospital_settlements_updated_at ON hospital_settlements;
CREATE TRIGGER update_hospital_settlements_updated_at
  BEFORE UPDATE ON hospital_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Patient Credits
DROP TRIGGER IF EXISTS update_patient_credits_updated_at ON patient_credits;
CREATE TRIGGER update_patient_credits_updated_at
  BEFORE UPDATE ON patient_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ratings
DROP TRIGGER IF EXISTS update_ratings_updated_at ON ratings;
CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notification Templates
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notifications
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notification Preferences
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User Sessions
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- API Keys
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Support Tickets
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RATING UPDATE TRIGGERS
-- ============================================================

-- Trigger: Update doctor rating on new rating
DROP TRIGGER IF EXISTS trigger_update_doctor_rating_insert ON ratings;
CREATE TRIGGER trigger_update_doctor_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  WHEN (NEW.doctor_id IS NOT NULL)
  EXECUTE FUNCTION update_doctor_rating();

-- Trigger: Update doctor rating on rating update
DROP TRIGGER IF EXISTS trigger_update_doctor_rating_update ON ratings;
CREATE TRIGGER trigger_update_doctor_rating_update
  AFTER UPDATE ON ratings
  FOR EACH ROW
  WHEN (NEW.doctor_id IS NOT NULL OR OLD.doctor_id IS NOT NULL)
  EXECUTE FUNCTION update_doctor_rating();

-- Trigger: Update doctor rating on rating delete
DROP TRIGGER IF EXISTS trigger_update_doctor_rating_delete ON ratings;
CREATE TRIGGER trigger_update_doctor_rating_delete
  AFTER DELETE ON ratings
  FOR EACH ROW
  WHEN (OLD.doctor_id IS NOT NULL)
  EXECUTE FUNCTION update_doctor_rating();

-- Trigger: Update hospital rating on new rating
DROP TRIGGER IF EXISTS trigger_update_hospital_rating_insert ON ratings;
CREATE TRIGGER trigger_update_hospital_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW
  WHEN (NEW.hospital_id IS NOT NULL)
  EXECUTE FUNCTION update_hospital_rating();

-- Trigger: Update hospital rating on rating update
DROP TRIGGER IF EXISTS trigger_update_hospital_rating_update ON ratings;
CREATE TRIGGER trigger_update_hospital_rating_update
  AFTER UPDATE ON ratings
  FOR EACH ROW
  WHEN (NEW.hospital_id IS NOT NULL OR OLD.hospital_id IS NOT NULL)
  EXECUTE FUNCTION update_hospital_rating();

-- Trigger: Update hospital rating on rating delete
DROP TRIGGER IF EXISTS trigger_update_hospital_rating_delete ON ratings;
CREATE TRIGGER trigger_update_hospital_rating_delete
  AFTER DELETE ON ratings
  FOR EACH ROW
  WHEN (OLD.hospital_id IS NOT NULL)
  EXECUTE FUNCTION update_hospital_rating();

-- ============================================================
-- CONSULTATION COUNTER TRIGGERS
-- ============================================================

-- Trigger: Increment consultation count on appointment completion
DROP TRIGGER IF EXISTS trigger_increment_consultations ON appointments;
CREATE TRIGGER trigger_increment_consultations
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION increment_doctor_consultations();

-- ============================================================
-- BOOKING ID TRIGGERS
-- ============================================================

-- Function: Set booking ID before insert
CREATE OR REPLACE FUNCTION set_booking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_id IS NULL THEN
    NEW.booking_id := generate_booking_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate booking ID
DROP TRIGGER IF EXISTS trigger_set_booking_id ON appointments;
CREATE TRIGGER trigger_set_booking_id
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_id();

-- ============================================================
-- PRESCRIPTION NUMBER TRIGGERS
-- ============================================================

-- Function: Set prescription number before insert
CREATE OR REPLACE FUNCTION set_prescription_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prescription_number IS NULL THEN
    NEW.prescription_number := generate_prescription_number(NEW.hospital_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate prescription number
DROP TRIGGER IF EXISTS trigger_set_prescription_number ON prescriptions;
CREATE TRIGGER trigger_set_prescription_number
  BEFORE INSERT ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_prescription_number();

-- ============================================================
-- SUPPORT TICKET TRIGGERS
-- ============================================================

-- Function: Set ticket number before insert
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate ticket number
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON support_tickets;
CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- ============================================================
-- SLOT AVAILABILITY TRIGGERS
-- ============================================================

-- Function: Mark slot as booked
CREATE OR REPLACE FUNCTION mark_slot_booked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL THEN
    UPDATE appointment_slots
    SET is_booked = true
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Release slot on cancellation
CREATE OR REPLACE FUNCTION release_slot_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.slot_id IS NOT NULL AND NEW.status IN ('cancelled', 'rescheduled') THEN
    UPDATE appointment_slots
    SET is_booked = false
    WHERE id = OLD.slot_id;
    
    -- Notify waitlist (handled by application layer via notification)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Mark slot as booked on appointment creation
DROP TRIGGER IF EXISTS trigger_mark_slot_booked ON appointments;
CREATE TRIGGER trigger_mark_slot_booked
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION mark_slot_booked();

-- Trigger: Release slot on cancellation
DROP TRIGGER IF EXISTS trigger_release_slot ON appointments;
CREATE TRIGGER trigger_release_slot
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (NEW.status IN ('cancelled', 'rescheduled') AND OLD.status NOT IN ('cancelled', 'rescheduled'))
  EXECUTE FUNCTION release_slot_on_cancel();

-- ============================================================
-- NOTIFICATION PREFERENCE TRIGGERS
-- ============================================================

-- Function: Create default notification preferences for new user
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (
    user_id,
    appointment_reminders,
    promotional_messages,
    health_tips,
    system_updates,
    sms_enabled,
    email_enabled,
    push_enabled,
    whatsapp_enabled,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end
  ) VALUES (
    NEW.id,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    '22:00:00',
    '08:00:00'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create notification preferences for new user
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON users;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- ============================================================
-- PATIENT CREDITS TRIGGERS
-- ============================================================

-- Function: Create patient credits record for new patient
CREATE OR REPLACE FUNCTION create_patient_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'patient' THEN
    INSERT INTO patient_credits (patient_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (patient_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create credits record for new patient
DROP TRIGGER IF EXISTS trigger_create_patient_credits ON users;
CREATE TRIGGER trigger_create_patient_credits
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'patient')
  EXECUTE FUNCTION create_patient_credits();

-- ============================================================
-- AUDIT LOG TRIGGERS
-- ============================================================

-- Function: Log appointment status changes
CREATE OR REPLACE FUNCTION log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address
    ) VALUES (
      COALESCE(NEW.cancelled_by, NEW.patient_id),
      'update',
      'appointment',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'reason', NEW.cancellation_reason),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Log appointment status changes
DROP TRIGGER IF EXISTS trigger_log_appointment_status ON appointments;
CREATE TRIGGER trigger_log_appointment_status
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_appointment_status_change();

-- Function: Log payment status changes
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address
    ) VALUES (
      NEW.patient_id,
      'update',
      'payment',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Log payment status changes
DROP TRIGGER IF EXISTS trigger_log_payment_status ON payments;
CREATE TRIGGER trigger_log_payment_status
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_payment_status_change();

-- ============================================================
-- SESSION CLEANUP TRIGGER (SCHEDULED VIA CRON/PG_CRON)
-- ============================================================

-- Function: Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW()
    OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '7 days');
  
  DELETE FROM otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUTO-CANCEL UNPAID APPOINTMENTS
-- ============================================================

-- Function: Auto-cancel unpaid appointments after timeout
CREATE OR REPLACE FUNCTION auto_cancel_unpaid_appointments()
RETURNS void AS $$
BEGIN
  UPDATE appointments
  SET 
    status = 'cancelled',
    cancellation_reason = 'Payment timeout - automatically cancelled',
    cancelled_at = NOW()
  WHERE status = 'pending_payment'
    AND payment_deadline < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- NO-SHOW MARKING (SCHEDULED VIA CRON)
-- ============================================================

-- Function: Mark appointments as no-show
CREATE OR REPLACE FUNCTION mark_no_show_appointments()
RETURNS void AS $$
BEGIN
  UPDATE appointments
  SET status = 'no_show'
  WHERE status = 'confirmed'
    AND (appointment_date + end_time) < NOW() - INTERVAL '30 minutes'
    AND check_in_time IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INVOICE NUMBER TRIGGER
-- ============================================================

-- Function: Set invoice number before insert
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number(NEW.invoice_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-generate invoice number
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- ============================================================
-- MEDICATION LOG TRIGGER
-- ============================================================

-- Function: Update last taken on medication log
CREATE OR REPLACE FUNCTION update_reminder_last_taken()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.taken = true THEN
    UPDATE medication_reminders
    SET 
      last_taken = NEW.taken_at,
      missed_count = CASE 
        WHEN missed_count > 0 THEN missed_count - 1 
        ELSE 0 
      END
    WHERE id = NEW.reminder_id;
  ELSE
    UPDATE medication_reminders
    SET missed_count = missed_count + 1
    WHERE id = NEW.reminder_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update reminder on medication log
DROP TRIGGER IF EXISTS trigger_update_reminder_last_taken ON medication_logs;
CREATE TRIGGER trigger_update_reminder_last_taken
  AFTER INSERT ON medication_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_last_taken();

-- ============================================================
-- END OF MIGRATION 009
-- ============================================================
