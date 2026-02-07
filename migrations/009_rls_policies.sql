-- ============================================================
-- ROZX Healthcare Platform - Migration 009
-- Row Level Security Policies (Supabase Ready)
-- ============================================================
--
-- ROLES SUMMARY:
-- patient   - Self + family members data only
-- reception - Hospital-scoped, booking & check-in only
-- doctor    - Hospital-scoped, medical data access
-- hospital  - Hospital-scoped, operational control
-- pharmacy  - Platform-wide medicine & orders
-- admin     - Full platform access
--
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================

-- Get current user ID from JWT
CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::JSON->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Get current user role from JWT
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::JSON->>'user_role',
    current_setting('app.current_user_role', true)
  )::user_role;
$$ LANGUAGE SQL STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_auth_user_role() = 'admin';
$$ LANGUAGE SQL STABLE;

-- Check if user is pharmacy
CREATE OR REPLACE FUNCTION is_pharmacy()
RETURNS BOOLEAN AS $$
  SELECT get_auth_user_role() = 'pharmacy';
$$ LANGUAGE SQL STABLE;

-- Get doctor's hospital ID
CREATE OR REPLACE FUNCTION get_doctor_hospital_id()
RETURNS UUID AS $$
  SELECT hospital_id FROM doctors WHERE user_id = get_auth_user_id() LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get staff's hospital ID
CREATE OR REPLACE FUNCTION get_staff_hospital_id()
RETURNS UUID AS $$
  SELECT hospital_id FROM hospital_staff WHERE user_id = get_auth_user_id() AND is_active = true LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get hospital admin's hospital ID
CREATE OR REPLACE FUNCTION get_admin_hospital_id()
RETURNS UUID AS $$
  SELECT id FROM hospitals WHERE admin_user_id = get_auth_user_id() LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Users can view their own profile
CREATE POLICY users_select_own ON users FOR SELECT
  USING (id = get_auth_user_id() OR is_admin());

-- Users can update their own profile
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = get_auth_user_id())
  WITH CHECK (id = get_auth_user_id());

-- Admin can manage all users
CREATE POLICY users_admin_all ON users FOR ALL
  USING (is_admin());

-- ============================================================
-- FAMILY MEMBERS POLICIES
-- ============================================================

-- Patients can manage their family members
CREATE POLICY family_members_own ON family_members FOR ALL
  USING (user_id = get_auth_user_id() OR is_admin());

-- ============================================================
-- USER SESSIONS POLICIES
-- ============================================================

CREATE POLICY sessions_own ON user_sessions FOR ALL
  USING (user_id = get_auth_user_id() OR is_admin());

-- ============================================================
-- HOSPITALS POLICIES
-- ============================================================

-- Public can view verified hospitals
CREATE POLICY hospitals_public_view ON hospitals FOR SELECT
  USING (is_active = true AND verification_status = 'verified');

-- Hospital admin can view/update their hospital
CREATE POLICY hospitals_admin_manage ON hospitals FOR ALL
  USING (admin_user_id = get_auth_user_id());

-- Doctors can view their hospital
CREATE POLICY hospitals_doctor_view ON hospitals FOR SELECT
  USING (id = get_doctor_hospital_id());

-- Reception can view their hospital
CREATE POLICY hospitals_staff_view ON hospitals FOR SELECT
  USING (id = get_staff_hospital_id());

-- Platform admin full access
CREATE POLICY hospitals_platform_admin ON hospitals FOR ALL
  USING (is_admin());

-- ============================================================
-- HOSPITAL STAFF POLICIES
-- ============================================================

-- Hospital admin can manage their staff
CREATE POLICY staff_hospital_admin ON hospital_staff FOR ALL
  USING (hospital_id = get_admin_hospital_id());

-- Staff can view their own record
CREATE POLICY staff_own_view ON hospital_staff FOR SELECT
  USING (user_id = get_auth_user_id());

-- Admin full access
CREATE POLICY staff_platform_admin ON hospital_staff FOR ALL
  USING (is_admin());

-- ============================================================
-- DOCTORS POLICIES
-- ============================================================

-- Public can view verified doctors
CREATE POLICY doctors_public_view ON doctors FOR SELECT
  USING (is_active = true AND verification_status = 'verified');

-- Doctor can view/update own profile
CREATE POLICY doctors_own ON doctors FOR SELECT
  USING (user_id = get_auth_user_id());

CREATE POLICY doctors_own_update ON doctors FOR UPDATE
  USING (user_id = get_auth_user_id())
  WITH CHECK (user_id = get_auth_user_id());

-- Hospital admin can manage their doctors
CREATE POLICY doctors_hospital_admin ON doctors FOR ALL
  USING (hospital_id = get_admin_hospital_id());

-- Admin full access
CREATE POLICY doctors_platform_admin ON doctors FOR ALL
  USING (is_admin());

-- ============================================================
-- SCHEDULES POLICIES
-- ============================================================

-- Public can view active schedules
CREATE POLICY schedules_public_view ON doctor_schedules FOR SELECT
  USING (is_active = true);

-- Doctor can manage own schedules (view only - hospital admin controls)
CREATE POLICY schedules_doctor_view ON doctor_schedules FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));

-- Hospital admin manages schedules
CREATE POLICY schedules_hospital_admin ON doctor_schedules FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_admin_hospital_id()));

-- Admin full access
CREATE POLICY schedules_platform_admin ON doctor_schedules FOR ALL
  USING (is_admin());

-- ============================================================
-- APPOINTMENT SLOTS POLICIES
-- ============================================================

-- Public can view available slots
CREATE POLICY slots_public_view ON appointment_slots FOR SELECT
  USING (is_available = true OR is_admin());

-- Hospital admin/reception can manage slots
CREATE POLICY slots_hospital_manage ON appointment_slots FOR ALL
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_admin_hospital_id())
    OR doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_staff_hospital_id())
  );

-- Admin full access
CREATE POLICY slots_platform_admin ON appointment_slots FOR ALL
  USING (is_admin());

-- ============================================================
-- APPOINTMENTS POLICIES
-- ============================================================

-- Patients can view their appointments
CREATE POLICY appointments_patient ON appointments FOR SELECT
  USING (patient_id = get_auth_user_id());

-- Patients can create appointments
CREATE POLICY appointments_patient_create ON appointments FOR INSERT
  WITH CHECK (patient_id = get_auth_user_id());

-- Patients can update (cancel) their appointments
CREATE POLICY appointments_patient_update ON appointments FOR UPDATE
  USING (patient_id = get_auth_user_id())
  WITH CHECK (patient_id = get_auth_user_id());

-- Reception can view/manage hospital appointments
CREATE POLICY appointments_reception ON appointments FOR ALL
  USING (hospital_id = get_staff_hospital_id());

-- Doctor can view their appointments
CREATE POLICY appointments_doctor_view ON appointments FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));

-- Hospital admin can view all hospital appointments
CREATE POLICY appointments_hospital_admin ON appointments FOR SELECT
  USING (hospital_id = get_admin_hospital_id());

-- Admin full access
CREATE POLICY appointments_platform_admin ON appointments FOR ALL
  USING (is_admin());

-- ============================================================
-- CONSULTATIONS POLICIES
-- ============================================================

-- Patient can view their consultations
CREATE POLICY consultations_patient ON consultations FOR SELECT
  USING (appointment_id IN (SELECT id FROM appointments WHERE patient_id = get_auth_user_id()));

-- Doctor can manage consultations
CREATE POLICY consultations_doctor ON consultations FOR ALL
  USING (appointment_id IN (
    SELECT a.id FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE d.user_id = get_auth_user_id()
  ));

-- Admin full access
CREATE POLICY consultations_platform_admin ON consultations FOR ALL
  USING (is_admin());

-- ============================================================
-- PRESCRIPTIONS POLICIES
-- ============================================================

-- Patient can view their prescriptions
CREATE POLICY prescriptions_patient ON prescriptions FOR SELECT
  USING (patient_id = get_auth_user_id());

-- Doctor can create/view prescriptions
CREATE POLICY prescriptions_doctor ON prescriptions FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));

-- Pharmacy can view prescriptions for verification
CREATE POLICY prescriptions_pharmacy ON prescriptions FOR SELECT
  USING (is_pharmacy());

-- Admin full access
CREATE POLICY prescriptions_platform_admin ON prescriptions FOR ALL
  USING (is_admin());

-- ============================================================
-- RATINGS POLICIES
-- ============================================================

-- Patients can create/view ratings
CREATE POLICY ratings_patient ON ratings FOR ALL
  USING (patient_id = get_auth_user_id());

-- Public can view visible ratings
CREATE POLICY ratings_public_view ON ratings FOR SELECT
  USING (is_visible = true);

-- Admin full access
CREATE POLICY ratings_platform_admin ON ratings FOR ALL
  USING (is_admin());

-- ============================================================
-- HEALTH DOCUMENTS POLICIES
-- ============================================================

-- Patients can manage their documents
CREATE POLICY documents_patient ON health_documents FOR ALL
  USING (patient_id = get_auth_user_id());

-- Doctors can view shared documents
CREATE POLICY documents_doctor_view ON health_documents FOR SELECT
  USING (
    is_shared = true
    AND get_auth_user_id() = ANY(
      SELECT user_id FROM doctors WHERE id = ANY(shared_doctors)
    )
  );

-- Admin full access
CREATE POLICY documents_platform_admin ON health_documents FOR ALL
  USING (is_admin());

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Users can view their payments
CREATE POLICY payments_own ON payments FOR SELECT
  USING (payer_user_id = get_auth_user_id());

-- Hospital admin can view hospital payments (read-only)
CREATE POLICY payments_hospital_view ON payments FOR SELECT
  USING (hospital_id = get_admin_hospital_id());

-- Reception can view/create payments (cash)
CREATE POLICY payments_reception ON payments FOR SELECT
  USING (hospital_id = get_staff_hospital_id());

CREATE POLICY payments_reception_insert ON payments FOR INSERT
  WITH CHECK (
    hospital_id = get_staff_hospital_id()
    AND payment_method = 'cash'
  );

-- Admin full access
CREATE POLICY payments_platform_admin ON payments FOR ALL
  USING (is_admin());

-- ============================================================
-- REFUNDS POLICIES (Admin controlled)
-- ============================================================

-- Users can view their refunds
CREATE POLICY refunds_own ON refunds FOR SELECT
  USING (payment_id IN (SELECT id FROM payments WHERE payer_user_id = get_auth_user_id()));

-- Admin full access (only admin can approve refunds)
CREATE POLICY refunds_platform_admin ON refunds FOR ALL
  USING (is_admin());

-- ============================================================
-- SETTLEMENTS POLICIES
-- ============================================================

-- Hospital admin can view their settlements (read-only)
CREATE POLICY settlements_hospital_view ON settlements FOR SELECT
  USING (entity_type = 'hospital' AND entity_id = get_admin_hospital_id());

-- Admin full access
CREATE POLICY settlements_platform_admin ON settlements FOR ALL
  USING (is_admin());

-- ============================================================
-- MEDICINES POLICIES (Pharmacy managed)
-- ============================================================

-- Public can view active medicines
CREATE POLICY medicines_public_view ON medicines FOR SELECT
  USING (is_active = true);

-- Pharmacy can manage medicines
CREATE POLICY medicines_pharmacy ON medicines FOR ALL
  USING (is_pharmacy());

-- Admin full access
CREATE POLICY medicines_platform_admin ON medicines FOR ALL
  USING (is_admin());

-- ============================================================
-- MEDICINE ORDERS POLICIES
-- ============================================================

-- Patients can view their orders
CREATE POLICY orders_patient ON medicine_orders FOR SELECT
  USING (patient_id = get_auth_user_id());

-- Patients can create orders
CREATE POLICY orders_patient_create ON medicine_orders FOR INSERT
  WITH CHECK (patient_id = get_auth_user_id());

-- Patients can cancel pending orders
CREATE POLICY orders_patient_cancel ON medicine_orders FOR UPDATE
  USING (patient_id = get_auth_user_id() AND status = 'pending')
  WITH CHECK (patient_id = get_auth_user_id());

-- Pharmacy full access
CREATE POLICY orders_pharmacy ON medicine_orders FOR ALL
  USING (is_pharmacy());

-- Admin full access
CREATE POLICY orders_platform_admin ON medicine_orders FOR ALL
  USING (is_admin());

-- ============================================================
-- MEDICINE ORDER ITEMS POLICIES
-- ============================================================

-- Patients can view their order items
CREATE POLICY order_items_patient ON medicine_order_items FOR SELECT
  USING (order_id IN (SELECT id FROM medicine_orders WHERE patient_id = get_auth_user_id()));

-- Pharmacy full access
CREATE POLICY order_items_pharmacy ON medicine_order_items FOR ALL
  USING (is_pharmacy());

-- Admin full access
CREATE POLICY order_items_platform_admin ON medicine_order_items FOR ALL
  USING (is_admin());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

-- Users can view/update their notifications
CREATE POLICY notifications_own ON notifications FOR ALL
  USING (user_id = get_auth_user_id());

-- Admin full access
CREATE POLICY notifications_platform_admin ON notifications FOR ALL
  USING (is_admin());

-- ============================================================
-- SUPPORT TICKETS POLICIES
-- ============================================================

-- Users can manage their tickets
CREATE POLICY tickets_own ON support_tickets FOR ALL
  USING (user_id = get_auth_user_id());

-- Admin full access
CREATE POLICY tickets_platform_admin ON support_tickets FOR ALL
  USING (is_admin());

-- ============================================================
-- TICKET MESSAGES POLICIES
-- ============================================================

-- Users can view messages on their tickets (non-internal)
CREATE POLICY ticket_messages_own ON ticket_messages FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = get_auth_user_id())
    AND is_internal = false
  );

-- Users can add messages to their tickets
CREATE POLICY ticket_messages_own_insert ON ticket_messages FOR INSERT
  WITH CHECK (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = get_auth_user_id()));

-- Admin full access
CREATE POLICY ticket_messages_platform_admin ON ticket_messages FOR ALL
  USING (is_admin());

-- ============================================================
-- AUDIT LOGS POLICIES (Admin only)
-- ============================================================

CREATE POLICY audit_logs_platform_admin ON audit_logs FOR ALL
  USING (is_admin());

-- ============================================================
-- APPOINTMENT ATTACHMENTS POLICIES
-- ============================================================

-- Patients can manage attachments for their appointments
CREATE POLICY attachments_patient ON appointment_attachments FOR ALL
  USING (appointment_id IN (SELECT id FROM appointments WHERE patient_id = get_auth_user_id()));

-- Doctor can view attachments for their consultations
CREATE POLICY attachments_doctor ON appointment_attachments FOR SELECT
  USING (appointment_id IN (
    SELECT a.id FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE d.user_id = get_auth_user_id()
  ));

-- Admin full access
CREATE POLICY attachments_platform_admin ON appointment_attachments FOR ALL
  USING (is_admin());

-- ============================================================
-- PATIENT VITALS POLICIES
-- ============================================================

-- Patients can manage their vitals
CREATE POLICY vitals_patient ON patient_vitals FOR ALL
  USING (patient_id = get_auth_user_id());

-- Doctors can view/create vitals for their patients
CREATE POLICY vitals_doctor ON patient_vitals FOR ALL
  USING (consultation_id IN (
    SELECT c.id FROM consultations c
    JOIN appointments a ON c.appointment_id = a.id
    JOIN doctors d ON a.doctor_id = d.id
    WHERE d.user_id = get_auth_user_id()
  ));

-- Admin full access
CREATE POLICY vitals_platform_admin ON patient_vitals FOR ALL
  USING (is_admin());

-- ============================================================
-- MEDICATION REMINDERS POLICIES
-- ============================================================

-- Patients can manage their reminders
CREATE POLICY reminders_patient ON medication_reminders FOR ALL
  USING (patient_id = get_auth_user_id());

-- Admin full access
CREATE POLICY reminders_platform_admin ON medication_reminders FOR ALL
  USING (is_admin());

-- ============================================================
-- MEDICATION LOGS POLICIES
-- ============================================================

-- Patients can manage their logs
CREATE POLICY med_logs_patient ON medication_logs FOR ALL
  USING (patient_id = get_auth_user_id());

-- Admin full access
CREATE POLICY med_logs_platform_admin ON medication_logs FOR ALL
  USING (is_admin());

-- ============================================================
-- API KEYS POLICIES
-- ============================================================

-- Users can manage their API keys
CREATE POLICY api_keys_own ON api_keys FOR ALL
  USING (user_id = get_auth_user_id());

-- Hospital admin can manage hospital API keys
CREATE POLICY api_keys_hospital ON api_keys FOR ALL
  USING (hospital_id = get_admin_hospital_id());

-- Admin full access
CREATE POLICY api_keys_platform_admin ON api_keys FOR ALL
  USING (is_admin());

-- ============================================================
-- SCHEDULED NOTIFICATIONS POLICIES
-- ============================================================

-- Users can view their scheduled notifications
CREATE POLICY scheduled_notifications_own ON scheduled_notifications FOR SELECT
  USING (user_id = get_auth_user_id());

-- Admin full access
CREATE POLICY scheduled_notifications_platform_admin ON scheduled_notifications FOR ALL
  USING (is_admin());

