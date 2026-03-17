-- ============================================================
-- ROZX Healthcare Platform — Migration 010
-- Row Level Security Policies
-- ============================================================
-- Depends on: 009 (functions)
-- Coverage: ALL tables including new financial tables
-- ============================================================

-- ======================== ENABLE RLS ON ALL TABLES ========================

-- Auth
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Hospital & Doctor
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;

-- Appointments
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- Payments & Financial
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_state_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;

-- Settlements & Payouts
ALTER TABLE payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hold_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settlement_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;

-- Pharmacy
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_settlements ENABLE ROW LEVEL SECURITY;

-- Notifications & Support
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- New tables from 004 & 008
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_helpfulness ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE specializations ENABLE ROW LEVEL SECURITY;

-- Auth tables needing RLS
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- ======================== HELPER FUNCTIONS ========================

CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::JSON->>'sub',
    current_setting('app.current_user_id', true)
  )::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::JSON->>'user_role',
    current_setting('app.current_user_role', true)
  )::user_role;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_auth_user_role() = 'admin';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_pharmacy()
RETURNS BOOLEAN AS $$
  SELECT get_auth_user_role() = 'pharmacy';
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_doctor_hospital_id()
RETURNS UUID AS $$
  SELECT hospital_id FROM doctors WHERE user_id = get_auth_user_id() LIMIT 1;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_staff_hospital_id()
RETURNS UUID AS $$
  SELECT hospital_id FROM hospital_staff WHERE user_id = get_auth_user_id() AND is_active = true LIMIT 1;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION get_admin_hospital_id()
RETURNS UUID AS $$
  SELECT id FROM hospitals WHERE admin_user_id = get_auth_user_id() LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ======================== USERS ========================

CREATE POLICY users_select_own ON users FOR SELECT
  USING (id = get_auth_user_id() OR is_admin());
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = get_auth_user_id()) WITH CHECK (id = get_auth_user_id());
CREATE POLICY users_admin_all ON users FOR ALL
  USING (is_admin());

-- ======================== FAMILY MEMBERS ========================

CREATE POLICY family_members_own ON family_members FOR ALL
  USING (user_id = get_auth_user_id() OR is_admin());

-- ======================== USER SESSIONS ========================

CREATE POLICY sessions_own ON user_sessions FOR ALL
  USING (user_id = get_auth_user_id() OR is_admin());

-- ======================== HOSPITALS ========================

CREATE POLICY hospitals_public_view ON hospitals FOR SELECT
  USING (is_active = true AND verification_status = 'verified');
CREATE POLICY hospitals_admin_manage ON hospitals FOR ALL
  USING (admin_user_id = get_auth_user_id());
CREATE POLICY hospitals_doctor_view ON hospitals FOR SELECT
  USING (id = get_doctor_hospital_id());
CREATE POLICY hospitals_staff_view ON hospitals FOR SELECT
  USING (id = get_staff_hospital_id());
CREATE POLICY hospitals_platform_admin ON hospitals FOR ALL
  USING (is_admin());

-- ======================== HOSPITAL STAFF ========================

CREATE POLICY staff_hospital_manage ON hospital_staff FOR ALL
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY staff_own_view ON hospital_staff FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY staff_platform_admin ON hospital_staff FOR ALL
  USING (is_admin());

-- ======================== DOCTORS ========================

CREATE POLICY doctors_public_view ON doctors FOR SELECT
  USING (is_active = true AND verification_status = 'verified');
CREATE POLICY doctors_own ON doctors FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY doctors_own_update ON doctors FOR UPDATE
  USING (user_id = get_auth_user_id()) WITH CHECK (user_id = get_auth_user_id());
CREATE POLICY doctors_hospital_manage ON doctors FOR ALL
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY doctors_platform_admin ON doctors FOR ALL
  USING (is_admin());

-- ======================== SCHEDULES ========================

CREATE POLICY schedules_public_view ON doctor_schedules FOR SELECT
  USING (is_active = true);
CREATE POLICY schedules_doctor_view ON doctor_schedules FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY schedules_hospital_manage ON doctor_schedules FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_admin_hospital_id()));
CREATE POLICY schedules_platform_admin ON doctor_schedules FOR ALL
  USING (is_admin());

-- ======================== SCHEDULE OVERRIDES ========================

CREATE POLICY overrides_doctor_view ON schedule_overrides FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY overrides_hospital_manage ON schedule_overrides FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_admin_hospital_id()));
CREATE POLICY overrides_platform_admin ON schedule_overrides FOR ALL
  USING (is_admin());

-- ======================== APPOINTMENT SLOTS ========================

CREATE POLICY slots_public_view ON appointment_slots FOR SELECT
  USING (is_available = true OR is_admin());
CREATE POLICY slots_hospital_manage ON appointment_slots FOR ALL
  USING (
    doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_admin_hospital_id())
    OR doctor_id IN (SELECT id FROM doctors WHERE hospital_id = get_staff_hospital_id())
  );
CREATE POLICY slots_platform_admin ON appointment_slots FOR ALL
  USING (is_admin());

-- ======================== APPOINTMENTS ========================

CREATE POLICY appointments_patient ON appointments FOR SELECT
  USING (patient_id = get_auth_user_id());
CREATE POLICY appointments_patient_create ON appointments FOR INSERT
  WITH CHECK (patient_id = get_auth_user_id());
CREATE POLICY appointments_patient_update ON appointments FOR UPDATE
  USING (patient_id = get_auth_user_id()) WITH CHECK (patient_id = get_auth_user_id());
CREATE POLICY appointments_reception ON appointments FOR ALL
  USING (hospital_id = get_staff_hospital_id());
CREATE POLICY appointments_doctor_view ON appointments FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY appointments_hospital_manage ON appointments FOR SELECT
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY appointments_platform_admin ON appointments FOR ALL
  USING (is_admin());

-- ======================== CONSULTATIONS ========================

CREATE POLICY consultations_patient ON consultations FOR SELECT
  USING (appointment_id IN (SELECT id FROM appointments WHERE patient_id = get_auth_user_id()));
CREATE POLICY consultations_doctor ON consultations FOR ALL
  USING (appointment_id IN (
    SELECT a.id FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE d.user_id = get_auth_user_id()
  ));
CREATE POLICY consultations_platform_admin ON consultations FOR ALL
  USING (is_admin());

-- ======================== PRESCRIPTIONS ========================

CREATE POLICY prescriptions_patient ON prescriptions FOR SELECT
  USING (patient_id = get_auth_user_id());
CREATE POLICY prescriptions_doctor ON prescriptions FOR ALL
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY prescriptions_pharmacy ON prescriptions FOR SELECT
  USING (is_pharmacy());
CREATE POLICY prescriptions_platform_admin ON prescriptions FOR ALL
  USING (is_admin());

-- ======================== RATINGS ========================

CREATE POLICY ratings_patient ON ratings FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY ratings_public_view ON ratings FOR SELECT
  USING (is_visible = true);
CREATE POLICY ratings_platform_admin ON ratings FOR ALL
  USING (is_admin());

-- ======================== HEALTH DOCUMENTS ========================

CREATE POLICY documents_patient ON health_documents FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY documents_doctor_view ON health_documents FOR SELECT
  USING (is_shared = true AND get_auth_user_id() = ANY(
    SELECT user_id FROM doctors WHERE id = ANY(shared_doctors)
  ));
CREATE POLICY documents_platform_admin ON health_documents FOR ALL
  USING (is_admin());

-- ======================== APPOINTMENT ATTACHMENTS ========================

CREATE POLICY attachments_patient ON appointment_attachments FOR ALL
  USING (appointment_id IN (SELECT id FROM appointments WHERE patient_id = get_auth_user_id()));
CREATE POLICY attachments_doctor ON appointment_attachments FOR SELECT
  USING (appointment_id IN (
    SELECT a.id FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE d.user_id = get_auth_user_id()
  ));
CREATE POLICY attachments_platform_admin ON appointment_attachments FOR ALL
  USING (is_admin());

-- ======================== PATIENT VITALS ========================

CREATE POLICY vitals_patient ON patient_vitals FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY vitals_doctor ON patient_vitals FOR ALL
  USING (consultation_id IN (
    SELECT c.id FROM consultations c JOIN appointments a ON c.appointment_id = a.id
    JOIN doctors d ON a.doctor_id = d.id WHERE d.user_id = get_auth_user_id()
  ));
CREATE POLICY vitals_platform_admin ON patient_vitals FOR ALL
  USING (is_admin());

-- ======================== MEDICATION REMINDERS ========================

CREATE POLICY reminders_patient ON medication_reminders FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY reminders_platform_admin ON medication_reminders FOR ALL
  USING (is_admin());

-- ======================== MEDICATION LOGS ========================

CREATE POLICY med_logs_patient ON medication_logs FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY med_logs_platform_admin ON medication_logs FOR ALL
  USING (is_admin());

-- ======================== PAYMENTS ========================

CREATE POLICY payments_own ON payments FOR SELECT
  USING (payer_user_id = get_auth_user_id());
CREATE POLICY payments_hospital_view ON payments FOR SELECT
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY payments_reception ON payments FOR SELECT
  USING (hospital_id = get_staff_hospital_id());
CREATE POLICY payments_reception_insert ON payments FOR INSERT
  WITH CHECK (hospital_id = get_staff_hospital_id() AND payment_method = 'cash');
CREATE POLICY payments_platform_admin ON payments FOR ALL
  USING (is_admin());

-- ======================== PAYMENT STATE LOG (admin only) ========================

CREATE POLICY payment_state_log_admin ON payment_state_log FOR ALL
  USING (is_admin());
CREATE POLICY payment_state_log_hospital_view ON payment_state_log FOR SELECT
  USING (payment_id IN (SELECT id FROM payments WHERE hospital_id = get_admin_hospital_id()));

-- ======================== REFUNDS ========================

CREATE POLICY refunds_own ON refunds FOR SELECT
  USING (payment_id IN (SELECT id FROM payments WHERE payer_user_id = get_auth_user_id()));
CREATE POLICY refunds_platform_admin ON refunds FOR ALL
  USING (is_admin());

-- ======================== GST LEDGER (admin only) ========================

CREATE POLICY gst_ledger_admin ON gst_ledger FOR ALL
  USING (is_admin());

-- ======================== GATEWAY WEBHOOK EVENTS (admin only) ========================

CREATE POLICY webhook_events_admin ON gateway_webhook_events FOR ALL
  USING (is_admin());

-- ======================== PAYMENT DISPUTES ========================

CREATE POLICY disputes_hospital_view ON payment_disputes FOR SELECT
  USING (payment_id IN (SELECT id FROM payments WHERE hospital_id = get_admin_hospital_id()));
CREATE POLICY disputes_admin ON payment_disputes FOR ALL
  USING (is_admin());

-- ======================== PAYOUT ACCOUNTS ========================

CREATE POLICY payout_accounts_hospital ON payout_accounts FOR SELECT
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY payout_accounts_admin ON payout_accounts FOR ALL
  USING (is_admin());

-- ======================== SETTLEMENTS ========================

CREATE POLICY settlements_hospital_view ON settlements FOR SELECT
  USING (entity_type = 'hospital' AND entity_id = get_admin_hospital_id());
CREATE POLICY settlements_platform_admin ON settlements FOR ALL
  USING (is_admin());

-- ======================== SETTLEMENT LINE ITEMS ========================

CREATE POLICY settlement_items_hospital_view ON settlement_line_items FOR SELECT
  USING (settlement_id IN (
    SELECT id FROM settlements WHERE entity_type = 'hospital' AND entity_id = get_admin_hospital_id()
  ));
CREATE POLICY settlement_items_admin ON settlement_line_items FOR ALL
  USING (is_admin());

-- ======================== PAYOUTS ========================

CREATE POLICY payouts_hospital_view ON payouts FOR SELECT
  USING (payout_account_id IN (SELECT id FROM payout_accounts WHERE hospital_id = get_admin_hospital_id()));
CREATE POLICY payouts_admin ON payouts FOR ALL
  USING (is_admin());

-- ======================== PAYOUT ITEMS ========================

CREATE POLICY payout_items_hospital_view ON payout_items FOR SELECT
  USING (payout_id IN (
    SELECT p.id FROM payouts p JOIN payout_accounts pa ON p.payout_account_id = pa.id
    WHERE pa.hospital_id = get_admin_hospital_id()
  ));
CREATE POLICY payout_items_admin ON payout_items FOR ALL
  USING (is_admin());

-- ======================== FINANCIAL LEDGER (admin only) ========================

CREATE POLICY ledger_admin ON financial_ledger FOR SELECT
  USING (is_admin());

-- ======================== HOLD FUNDS ========================

CREATE POLICY hold_funds_hospital_view ON hold_funds FOR SELECT
  USING (entity_type = 'hospital' AND entity_id = get_admin_hospital_id());
CREATE POLICY hold_funds_admin ON hold_funds FOR ALL
  USING (is_admin());

-- ======================== RECONCILIATION (admin only) ========================

CREATE POLICY recon_admin ON reconciliation_records FOR ALL
  USING (is_admin());

-- ======================== COMMISSION SLABS (admin + read) ========================

CREATE POLICY commission_slabs_public_view ON commission_slabs FOR SELECT
  USING (is_active = true);
CREATE POLICY commission_slabs_admin ON commission_slabs FOR ALL
  USING (is_admin());

-- ======================== DAILY SETTLEMENT SUMMARY ========================

CREATE POLICY daily_summary_hospital_view ON daily_settlement_summary FOR SELECT
  USING (entity_type = 'hospital' AND entity_id = get_admin_hospital_id());
CREATE POLICY daily_summary_admin ON daily_settlement_summary FOR ALL
  USING (is_admin());

-- ======================== SETTLEMENT INVOICES ========================

CREATE POLICY settlement_invoices_hospital_view ON settlement_invoices FOR SELECT
  USING (settlement_id IN (
    SELECT id FROM settlements WHERE entity_type = 'hospital' AND entity_id = get_admin_hospital_id()
  ));
CREATE POLICY settlement_invoices_admin ON settlement_invoices FOR ALL
  USING (is_admin());

-- ======================== PLATFORM CONFIG ========================

CREATE POLICY platform_config_public_read ON platform_config FOR SELECT
  USING (true);  -- readable by all authenticated users
CREATE POLICY platform_config_admin ON platform_config FOR ALL
  USING (is_admin());

-- ======================== CANCELLATION POLICIES ========================

CREATE POLICY cancellation_policies_public_read ON cancellation_policies FOR SELECT
  USING (is_active = true);
CREATE POLICY cancellation_policies_admin ON cancellation_policies FOR ALL
  USING (is_admin());

-- ======================== MEDICINES ========================

CREATE POLICY medicines_public_view ON medicines FOR SELECT
  USING (is_active = true);
CREATE POLICY medicines_pharmacy ON medicines FOR ALL
  USING (is_pharmacy());
CREATE POLICY medicines_platform_admin ON medicines FOR ALL
  USING (is_admin());

-- ======================== MEDICINE ORDERS ========================

CREATE POLICY orders_patient ON medicine_orders FOR SELECT
  USING (patient_id = get_auth_user_id());
CREATE POLICY orders_patient_create ON medicine_orders FOR INSERT
  WITH CHECK (patient_id = get_auth_user_id());
CREATE POLICY orders_patient_cancel ON medicine_orders FOR UPDATE
  USING (patient_id = get_auth_user_id() AND status = 'pending')
  WITH CHECK (patient_id = get_auth_user_id());
CREATE POLICY orders_pharmacy ON medicine_orders FOR ALL
  USING (is_pharmacy());
CREATE POLICY orders_platform_admin ON medicine_orders FOR ALL
  USING (is_admin());

-- ======================== MEDICINE ORDER ITEMS ========================

CREATE POLICY order_items_patient ON medicine_order_items FOR SELECT
  USING (order_id IN (SELECT id FROM medicine_orders WHERE patient_id = get_auth_user_id()));
CREATE POLICY order_items_pharmacy ON medicine_order_items FOR ALL
  USING (is_pharmacy());
CREATE POLICY order_items_platform_admin ON medicine_order_items FOR ALL
  USING (is_admin());

-- ======================== DELIVERY TRACKING ========================

CREATE POLICY delivery_tracking_patient ON delivery_tracking FOR SELECT
  USING (order_id IN (SELECT id FROM medicine_orders WHERE patient_id = get_auth_user_id()));
CREATE POLICY delivery_tracking_pharmacy ON delivery_tracking FOR ALL
  USING (is_pharmacy());
CREATE POLICY delivery_tracking_admin ON delivery_tracking FOR ALL
  USING (is_admin());

-- ======================== MEDICINE RETURNS ========================

CREATE POLICY medicine_returns_patient ON medicine_returns FOR SELECT
  USING (initiated_by = get_auth_user_id());
CREATE POLICY medicine_returns_patient_create ON medicine_returns FOR INSERT
  WITH CHECK (initiated_by = get_auth_user_id());
CREATE POLICY medicine_returns_pharmacy ON medicine_returns FOR ALL
  USING (is_pharmacy());
CREATE POLICY medicine_returns_admin ON medicine_returns FOR ALL
  USING (is_admin());

-- ======================== PHARMACY SETTLEMENTS ========================

CREATE POLICY pharmacy_settlements_hospital_view ON pharmacy_settlements FOR SELECT
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY pharmacy_settlements_pharmacy ON pharmacy_settlements FOR ALL
  USING (is_pharmacy());
CREATE POLICY pharmacy_settlements_admin ON pharmacy_settlements FOR ALL
  USING (is_admin());

-- ======================== NOTIFICATIONS ========================

CREATE POLICY notifications_own ON notifications FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY notifications_platform_admin ON notifications FOR ALL
  USING (is_admin());

-- ======================== NOTIFICATION PREFERENCES ========================

CREATE POLICY notif_prefs_own ON notification_preferences FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY notif_prefs_admin ON notification_preferences FOR ALL
  USING (is_admin());

-- ======================== SUPPORT TICKETS ========================

CREATE POLICY tickets_own ON support_tickets FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY tickets_platform_admin ON support_tickets FOR ALL
  USING (is_admin());

-- ======================== TICKET MESSAGES ========================

CREATE POLICY ticket_messages_own ON ticket_messages FOR SELECT
  USING (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = get_auth_user_id()) AND is_internal = false);
CREATE POLICY ticket_messages_own_insert ON ticket_messages FOR INSERT
  WITH CHECK (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = get_auth_user_id()));
CREATE POLICY ticket_messages_platform_admin ON ticket_messages FOR ALL
  USING (is_admin());

-- ======================== AUDIT LOGS (admin only) ========================

CREATE POLICY audit_logs_platform_admin ON audit_logs FOR ALL
  USING (is_admin());

-- ======================== SYSTEM LOGS (admin only) ========================

CREATE POLICY system_logs_admin ON system_logs FOR ALL
  USING (is_admin());

-- ======================== API KEYS ========================

CREATE POLICY api_keys_own ON api_keys FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY api_keys_hospital ON api_keys FOR ALL
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY api_keys_platform_admin ON api_keys FOR ALL
  USING (is_admin());

-- ======================== SCHEDULED NOTIFICATIONS ========================

CREATE POLICY scheduled_notifications_own ON scheduled_notifications FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY scheduled_notifications_platform_admin ON scheduled_notifications FOR ALL
  USING (is_admin());

-- ======================== SPECIALIZATIONS ========================

CREATE POLICY specializations_public_read ON specializations FOR SELECT
  USING (is_active = true);
CREATE POLICY specializations_admin ON specializations FOR ALL
  USING (is_admin());

-- ======================== APPOINTMENT WAITLIST ========================

CREATE POLICY waitlist_own ON appointment_waitlist FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY waitlist_doctor_view ON appointment_waitlist FOR SELECT
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY waitlist_hospital_manage ON appointment_waitlist FOR SELECT
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY waitlist_platform_admin ON appointment_waitlist FOR ALL
  USING (is_admin());

-- ======================== NOTIFICATION QUEUE (admin only) ========================

CREATE POLICY notif_queue_admin ON notification_queue FOR ALL
  USING (is_admin());

-- ======================== SCHEDULED REPORTS ========================

CREATE POLICY scheduled_reports_own ON scheduled_reports FOR ALL
  USING (created_by = get_auth_user_id());
CREATE POLICY scheduled_reports_admin ON scheduled_reports FOR ALL
  USING (is_admin());

-- ======================== HOSPITAL ANNOUNCEMENTS ========================

CREATE POLICY announcements_public_read ON hospital_announcements FOR SELECT
  USING (is_public = true AND is_active = true AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY announcements_hospital_manage ON hospital_announcements FOR ALL
  USING (hospital_id = get_admin_hospital_id());
CREATE POLICY announcements_platform_admin ON hospital_announcements FOR ALL
  USING (is_admin());

-- ======================== RATING HELPFULNESS ========================

CREATE POLICY rating_helpfulness_own ON rating_helpfulness FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY rating_helpfulness_admin ON rating_helpfulness FOR ALL
  USING (is_admin());

-- ======================== PATIENT CREDITS ========================

CREATE POLICY patient_credits_own ON patient_credits FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY patient_credits_admin ON patient_credits FOR ALL
  USING (is_admin());

-- ======================== CREDIT TRANSACTIONS ========================

CREATE POLICY credit_txn_own ON credit_transactions FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY credit_txn_admin ON credit_transactions FOR ALL
  USING (is_admin());

-- ======================== PATIENT MEDICATIONS ========================

CREATE POLICY patient_medications_own ON patient_medications FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY patient_medications_doctor ON patient_medications FOR SELECT
  USING (prescribed_by IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY patient_medications_admin ON patient_medications FOR ALL
  USING (is_admin());

-- ======================== PATIENT ALLERGIES ========================

CREATE POLICY patient_allergies_own ON patient_allergies FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY patient_allergies_doctor ON patient_allergies FOR SELECT
  USING (diagnosed_by IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY patient_allergies_admin ON patient_allergies FOR ALL
  USING (is_admin());

-- ======================== PATIENT MEDICAL CONDITIONS ========================

CREATE POLICY patient_conditions_own ON patient_medical_conditions FOR ALL
  USING (patient_id = get_auth_user_id());
CREATE POLICY patient_conditions_doctor ON patient_medical_conditions FOR SELECT
  USING (diagnosed_by IN (SELECT id FROM doctors WHERE user_id = get_auth_user_id()));
CREATE POLICY patient_conditions_admin ON patient_medical_conditions FOR ALL
  USING (is_admin());

-- ======================== OTP CODES (system managed) ========================
-- No user_id column — OTPs keyed by identifier (phone/email).
-- Access is controlled by the service layer; direct table access is admin-only.

CREATE POLICY otp_codes_admin ON otp_codes FOR ALL
  USING (is_admin());

-- ======================== PASSWORD RESET TOKENS (system managed) ========================

CREATE POLICY password_reset_own ON password_reset_tokens FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY password_reset_admin ON password_reset_tokens FOR ALL
  USING (is_admin());

-- ======================== LOGIN HISTORY ========================

CREATE POLICY login_history_own ON login_history FOR SELECT
  USING (user_id = get_auth_user_id());
CREATE POLICY login_history_admin ON login_history FOR ALL
  USING (is_admin());

-- ======================== DEVICE TOKENS ========================

CREATE POLICY device_tokens_own ON device_tokens FOR ALL
  USING (user_id = get_auth_user_id());
CREATE POLICY device_tokens_admin ON device_tokens FOR ALL
  USING (is_admin());

-- ======================== NOTIFICATION TEMPLATES ========================

CREATE POLICY notif_templates_public_read ON notification_templates FOR SELECT
  USING (is_active = true);
CREATE POLICY notif_templates_admin ON notification_templates FOR ALL
  USING (is_admin());
