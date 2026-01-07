-- ============================================================
-- ROZX Healthcare Platform - Migration 010
-- Row Level Security (RLS) Policies
-- Created: 2026-01-06
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_helpfulness ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Specializations is public read
ALTER TABLE specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SERVICE ROLE BYPASS
-- The backend uses service role which bypasses RLS
-- These policies are for direct Supabase client access
-- ============================================================

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Users can read their own data
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public profiles: Doctors and hospitals are publicly readable (limited fields via API)
DROP POLICY IF EXISTS users_select_public ON users;
CREATE POLICY users_select_public ON users
  FOR SELECT
  USING (
    role IN ('doctor', 'hospital') 
    AND is_active = true 
    AND is_blocked = false
  );

-- Admins can read all users
DROP POLICY IF EXISTS users_admin_all ON users;
CREATE POLICY users_admin_all ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- ============================================================
-- HOSPITALS TABLE POLICIES
-- ============================================================

-- Public can view verified hospitals
DROP POLICY IF EXISTS hospitals_select_public ON hospitals;
CREATE POLICY hospitals_select_public ON hospitals
  FOR SELECT
  USING (
    verification_status = 'verified' 
    AND is_active = true
  );

-- Hospital owners can manage their hospital
DROP POLICY IF EXISTS hospitals_owner_all ON hospitals;
CREATE POLICY hospitals_owner_all ON hospitals
  FOR ALL
  USING (admin_user_id = auth.uid());

-- Admins can manage all hospitals
DROP POLICY IF EXISTS hospitals_admin_all ON hospitals;
CREATE POLICY hospitals_admin_all ON hospitals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- ============================================================
-- DOCTORS TABLE POLICIES
-- ============================================================

-- Public can view verified doctors
DROP POLICY IF EXISTS doctors_select_public ON doctors;
CREATE POLICY doctors_select_public ON doctors
  FOR SELECT
  USING (
    verification_status = 'verified' 
    AND is_active = true
  );

-- Doctors can manage their own profile
DROP POLICY IF EXISTS doctors_owner_all ON doctors;
CREATE POLICY doctors_owner_all ON doctors
  FOR ALL
  USING (user_id = auth.uid());

-- Hospital owners can manage their doctors
DROP POLICY IF EXISTS doctors_hospital_all ON doctors;
CREATE POLICY doctors_hospital_all ON doctors
  FOR ALL
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- DOCTOR SCHEDULES POLICIES
-- ============================================================

-- Public can view schedules for booking
DROP POLICY IF EXISTS schedules_select_public ON doctor_schedules;
CREATE POLICY schedules_select_public ON doctor_schedules
  FOR SELECT
  USING (is_active = true);

-- Doctors can manage their schedules
DROP POLICY IF EXISTS schedules_doctor_all ON doctor_schedules;
CREATE POLICY schedules_doctor_all ON doctor_schedules
  FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

-- Hospital owners can manage doctor schedules
DROP POLICY IF EXISTS schedules_hospital_all ON doctor_schedules;
CREATE POLICY schedules_hospital_all ON doctor_schedules
  FOR ALL
  USING (
    doctor_id IN (
      SELECT d.id FROM doctors d 
      JOIN hospitals h ON d.hospital_id = h.id 
      WHERE h.admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- SCHEDULE OVERRIDES POLICIES
-- ============================================================

DROP POLICY IF EXISTS overrides_select_public ON schedule_overrides;
CREATE POLICY overrides_select_public ON schedule_overrides
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS overrides_doctor_all ON schedule_overrides;
CREATE POLICY overrides_doctor_all ON schedule_overrides
  FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FAMILY MEMBERS POLICIES
-- ============================================================

-- Users can manage their family members
DROP POLICY IF EXISTS family_members_owner ON family_members;
CREATE POLICY family_members_owner ON family_members
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- HEALTH DOCUMENTS POLICIES
-- ============================================================

-- Users can manage their own documents
DROP POLICY IF EXISTS health_documents_owner ON health_documents;
CREATE POLICY health_documents_owner ON health_documents
  FOR ALL
  USING (user_id = auth.uid());

-- Doctors can view documents for their patients
DROP POLICY IF EXISTS health_documents_doctor_select ON health_documents;
CREATE POLICY health_documents_doctor_select ON health_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id = health_documents.user_id
      AND d.user_id = auth.uid()
      AND a.status IN ('confirmed', 'in_progress', 'completed')
    )
  );

-- ============================================================
-- PATIENT VITALS POLICIES
-- ============================================================

DROP POLICY IF EXISTS patient_vitals_owner ON patient_vitals;
CREATE POLICY patient_vitals_owner ON patient_vitals
  FOR ALL
  USING (user_id = auth.uid() OR family_member_id IN (
    SELECT id FROM family_members WHERE user_id = auth.uid()
  ));

-- Doctors can view vitals of their patients
DROP POLICY IF EXISTS patient_vitals_doctor_select ON patient_vitals;
CREATE POLICY patient_vitals_doctor_select ON patient_vitals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id = patient_vitals.user_id
      AND d.user_id = auth.uid()
    )
  );

-- ============================================================
-- MEDICATION REMINDERS POLICIES
-- ============================================================

DROP POLICY IF EXISTS medication_reminders_owner ON medication_reminders;
CREATE POLICY medication_reminders_owner ON medication_reminders
  FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS medication_logs_owner ON medication_logs;
CREATE POLICY medication_logs_owner ON medication_logs
  FOR ALL
  USING (
    reminder_id IN (
      SELECT id FROM medication_reminders WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- APPOINTMENT SLOTS POLICIES
-- ============================================================

-- Public can view available slots
DROP POLICY IF EXISTS slots_select_public ON appointment_slots;
CREATE POLICY slots_select_public ON appointment_slots
  FOR SELECT
  USING (
    slot_date >= CURRENT_DATE 
    AND is_available = true
  );

-- Doctors can manage their slots
DROP POLICY IF EXISTS slots_doctor_all ON appointment_slots;
CREATE POLICY slots_doctor_all ON appointment_slots
  FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- APPOINTMENTS POLICIES
-- ============================================================

-- Patients can view and manage their appointments
DROP POLICY IF EXISTS appointments_patient ON appointments;
CREATE POLICY appointments_patient ON appointments
  FOR ALL
  USING (patient_id = auth.uid());

-- Patients can book for family members
DROP POLICY IF EXISTS appointments_family ON appointments;
CREATE POLICY appointments_family ON appointments
  FOR ALL
  USING (
    family_member_id IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Doctors can view and manage their appointments
DROP POLICY IF EXISTS appointments_doctor ON appointments;
CREATE POLICY appointments_doctor ON appointments
  FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

-- Hospital owners can view appointments
DROP POLICY IF EXISTS appointments_hospital ON appointments;
CREATE POLICY appointments_hospital ON appointments
  FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- CONSULTATIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS consultations_patient ON consultations;
CREATE POLICY consultations_patient ON consultations
  FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE patient_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS consultations_doctor ON consultations;
CREATE POLICY consultations_doctor ON consultations
  FOR ALL
  USING (
    appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- ============================================================
-- PRESCRIPTIONS POLICIES
-- ============================================================

-- Patients can view their prescriptions
DROP POLICY IF EXISTS prescriptions_patient ON prescriptions;
CREATE POLICY prescriptions_patient ON prescriptions
  FOR SELECT
  USING (patient_id = auth.uid());

-- Doctors can manage prescriptions they wrote
DROP POLICY IF EXISTS prescriptions_doctor ON prescriptions;
CREATE POLICY prescriptions_doctor ON prescriptions
  FOR ALL
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- APPOINTMENT WAITLIST POLICIES
-- ============================================================

DROP POLICY IF EXISTS waitlist_patient ON appointment_waitlist;
CREATE POLICY waitlist_patient ON appointment_waitlist
  FOR ALL
  USING (patient_id = auth.uid());

-- ============================================================
-- APPOINTMENT ATTACHMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS attachments_patient ON appointment_attachments;
CREATE POLICY attachments_patient ON appointment_attachments
  FOR ALL
  USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE patient_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS attachments_doctor_select ON appointment_attachments;
CREATE POLICY attachments_doctor_select ON appointment_attachments
  FOR SELECT
  USING (
    appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Patients can view their payments
DROP POLICY IF EXISTS payments_patient ON payments;
CREATE POLICY payments_patient ON payments
  FOR SELECT
  USING (patient_id = auth.uid());

-- Hospital owners can view their payments
DROP POLICY IF EXISTS payments_hospital ON payments;
CREATE POLICY payments_hospital ON payments
  FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- REFUNDS POLICIES
-- ============================================================

DROP POLICY IF EXISTS refunds_patient ON refunds;
CREATE POLICY refunds_patient ON refunds
  FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE patient_id = auth.uid()
    )
  );

-- ============================================================
-- HOSPITAL SETTLEMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS settlements_hospital ON hospital_settlements;
CREATE POLICY settlements_hospital ON hospital_settlements
  FOR SELECT
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS settlement_items_hospital ON settlement_line_items;
CREATE POLICY settlement_items_hospital ON settlement_line_items
  FOR SELECT
  USING (
    settlement_id IN (
      SELECT id FROM hospital_settlements WHERE hospital_id IN (
        SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- PATIENT CREDITS POLICIES
-- ============================================================

DROP POLICY IF EXISTS credits_patient ON patient_credits;
CREATE POLICY credits_patient ON patient_credits
  FOR SELECT
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS credit_transactions_patient ON credit_transactions;
CREATE POLICY credit_transactions_patient ON credit_transactions
  FOR SELECT
  USING (
    credit_id IN (
      SELECT id FROM patient_credits WHERE patient_id = auth.uid()
    )
  );

-- ============================================================
-- RATINGS POLICIES
-- ============================================================

-- Public can view visible ratings
DROP POLICY IF EXISTS ratings_select_public ON ratings;
CREATE POLICY ratings_select_public ON ratings
  FOR SELECT
  USING (is_visible = true);

-- Patients can manage their ratings
DROP POLICY IF EXISTS ratings_patient ON ratings;
CREATE POLICY ratings_patient ON ratings
  FOR ALL
  USING (patient_id = auth.uid());

-- Doctors can respond to ratings
DROP POLICY IF EXISTS ratings_doctor_update ON ratings;
CREATE POLICY ratings_doctor_update ON ratings
  FOR UPDATE
  USING (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    doctor_id IN (
      SELECT id FROM doctors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS helpfulness_user ON rating_helpfulness;
CREATE POLICY helpfulness_user ON rating_helpfulness
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- INVOICES POLICIES
-- ============================================================

DROP POLICY IF EXISTS invoices_patient ON invoices;
CREATE POLICY invoices_patient ON invoices
  FOR SELECT
  USING (
    to_entity_type = 'patient' AND to_entity_id = auth.uid()
  );

DROP POLICY IF EXISTS invoices_hospital ON invoices;
CREATE POLICY invoices_hospital ON invoices
  FOR SELECT
  USING (
    (to_entity_type = 'hospital' AND to_entity_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    ))
    OR
    (from_entity_type = 'hospital' AND from_entity_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    ))
  );

-- ============================================================
-- NOTIFICATION POLICIES
-- ============================================================

-- Templates: Admins only manage, system reads
DROP POLICY IF EXISTS templates_admin ON notification_templates;
CREATE POLICY templates_admin ON notification_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Notifications: Users see their own
DROP POLICY IF EXISTS notifications_user ON notifications;
CREATE POLICY notifications_user ON notifications
  FOR ALL
  USING (user_id = auth.uid());

-- Notification preferences: Users manage their own
DROP POLICY IF EXISTS preferences_user ON notification_preferences;
CREATE POLICY preferences_user ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- Device tokens: Users manage their own
DROP POLICY IF EXISTS device_tokens_user ON device_tokens;
CREATE POLICY device_tokens_user ON device_tokens
  FOR ALL
  USING (user_id = auth.uid());

-- Scheduled notifications: System only (via service role)
DROP POLICY IF EXISTS scheduled_select ON scheduled_notifications;
CREATE POLICY scheduled_select ON scheduled_notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Hospital announcements: Public for hospitals
DROP POLICY IF EXISTS announcements_select ON hospital_announcements;
CREATE POLICY announcements_select ON hospital_announcements
  FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS announcements_hospital_all ON hospital_announcements;
CREATE POLICY announcements_hospital_all ON hospital_announcements
  FOR ALL
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTH/SECURITY POLICIES
-- ============================================================

-- OTP codes: System only (via service role), users cannot access directly
DROP POLICY IF EXISTS otp_system ON otp_codes;
CREATE POLICY otp_system ON otp_codes
  FOR SELECT
  USING (false);  -- Never allow direct access via client

-- User sessions: Users see their own
DROP POLICY IF EXISTS sessions_user ON user_sessions;
CREATE POLICY sessions_user ON user_sessions
  FOR ALL
  USING (user_id = auth.uid());

-- Audit logs: Read-only for user's own, admins see all
DROP POLICY IF EXISTS audit_logs_user ON audit_logs;
CREATE POLICY audit_logs_user ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS audit_logs_admin ON audit_logs;
CREATE POLICY audit_logs_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Login history: Users see their own
DROP POLICY IF EXISTS login_history_user ON login_history;
CREATE POLICY login_history_user ON login_history
  FOR SELECT
  USING (user_id = auth.uid());

-- Password reset tokens: System only
DROP POLICY IF EXISTS password_reset_system ON password_reset_tokens;
CREATE POLICY password_reset_system ON password_reset_tokens
  FOR SELECT
  USING (false);

-- API keys: Hospital owners manage their own
DROP POLICY IF EXISTS api_keys_hospital ON api_keys;
CREATE POLICY api_keys_hospital ON api_keys
  FOR ALL
  USING (
    hospital_id IN (
      SELECT id FROM hospitals WHERE admin_user_id = auth.uid()
    )
  );

-- ============================================================
-- SUPPORT TICKETS POLICIES
-- ============================================================

-- Users can manage their own tickets
DROP POLICY IF EXISTS tickets_user ON support_tickets;
CREATE POLICY tickets_user ON support_tickets
  FOR ALL
  USING (user_id = auth.uid());

-- Admins can manage all tickets
DROP POLICY IF EXISTS tickets_admin ON support_tickets;
CREATE POLICY tickets_admin ON support_tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Ticket messages: Same as tickets
DROP POLICY IF EXISTS ticket_messages_user ON support_ticket_messages;
CREATE POLICY ticket_messages_user ON support_ticket_messages
  FOR ALL
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS ticket_messages_admin ON support_ticket_messages;
CREATE POLICY ticket_messages_admin ON support_ticket_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- ============================================================
-- PUBLIC TABLES POLICIES
-- ============================================================

-- Specializations: Public read
DROP POLICY IF EXISTS specializations_public ON specializations;
CREATE POLICY specializations_public ON specializations
  FOR SELECT
  USING (is_active = true);

-- System settings: Read for all authenticated users, admin write
DROP POLICY IF EXISTS settings_public_read ON system_settings;
CREATE POLICY settings_public_read ON system_settings
  FOR SELECT
  USING (true);  -- All settings readable, sensitive data should not be stored here

DROP POLICY IF EXISTS settings_admin_all ON system_settings;
CREATE POLICY settings_admin_all ON system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- ============================================================
-- END OF MIGRATION 010
-- ============================================================
