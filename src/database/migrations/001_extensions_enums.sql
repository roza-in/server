-- ============================================================
-- ROZX Healthcare Platform — Migration 001
-- Extensions & Enum Types
-- ============================================================
-- Run order: FIRST — no dependencies
-- ============================================================

-- ======================== EXTENSIONS ========================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram fuzzy search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Hashing / encryption
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- GiST index support (exclusion constraints)

-- ======================== USER & AUTH ========================

CREATE TYPE user_role AS ENUM (
  'patient',
  'reception',
  'doctor',
  'hospital',
  'pharmacy',
  'admin'
);

CREATE TYPE admin_tier AS ENUM (
    'super',    -- Full access to everything
    'finance',  -- Finance, revenue, settlements, platform fees
    'security', -- Security logs, sessions, audit trails
    'support',  -- Support tickets, user status, patient records
    'ops'       -- Notifications, system health, basic verifications
);

CREATE TYPE gender AS ENUM (
    'male', 
    'female', 
    'other'
);

CREATE TYPE blood_group AS ENUM (
  'A+', 
  'A-', 
  'B+', 
  'B-', 
  'AB+', 
  'AB-', 
  'O+', 
  'O-', 
  'unknown'
);

CREATE TYPE verification_status AS ENUM (
  'pending',
  'under_review',
  'verified',
  'rejected',
  'suspended'
);

CREATE TYPE otp_purpose AS ENUM (
  'registration',
  'login',
  'password_reset',
  'phone_verification',
  'email_verification',
  'transaction'
);

CREATE TYPE otp_channel AS ENUM (
    'sms', 
    'whatsapp', 
    'email'
);

CREATE TYPE family_relationship AS ENUM (
  'self', 
  'spouse', 
  'parent', 
  'child', 
  'sibling', 
  'other'
);

-- ======================== HOSPITAL & DOCTOR ========================

CREATE TYPE hospital_type AS ENUM (
  'multi_specialty',
  'single_specialty',
  'nursing_home',
  'clinic',
  'diagnostic_center',
  'medical_college',
  'primary_health'
);

CREATE TYPE day_of_week AS ENUM (
  'monday', 
  'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
);

CREATE TYPE schedule_override_type AS ENUM (
  'holiday', 'leave', 'emergency', 'special_hours'
);

-- ======================== APPOINTMENT ========================

CREATE TYPE consultation_type AS ENUM (
  'online',
  'in_person',
  'walk_in'
);

CREATE TYPE appointment_status AS ENUM (
  'pending_payment',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled'
);

CREATE TYPE consultation_status AS ENUM (
  'scheduled',
  'waiting',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
  'failed'
);

CREATE TYPE booking_source AS ENUM (
  'app', 'web', 'reception', 'admin'
);

-- ======================== PAYMENT ========================

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded',
  'expired',
  'disputed'
);

CREATE TYPE payment_method AS ENUM (
  'upi', 'card', 'net_banking', 'wallet', 'cash'
);

CREATE TYPE payment_type AS ENUM (
  'consultation',
  'medicine_order',
  'platform_fee'
);

CREATE TYPE refund_status AS ENUM (
  'pending',
  'approved',
  'processing',
  'completed',
  'rejected'
);

CREATE TYPE refund_reason AS ENUM (
  'patient_cancelled',
  'doctor_cancelled',
  'hospital_cancelled',
  'technical_failure',
  'policy_violation',
  'admin_override',
  'chargeback',
  'duplicate_payment',
  'service_not_rendered'
);

CREATE TYPE settlement_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'on_hold',
  'partially_paid'
);

-- ======================== PAYOUT & FINANCIAL (NEW) ========================

CREATE TYPE payout_status AS ENUM (
  'pending',
  'queued',
  'processing',
  'completed',
  'failed',
  'reversed',
  'cancelled'
);

CREATE TYPE payout_mode AS ENUM (
  'neft', 'rtgs', 'imps', 'upi', 'bank_transfer'
);

CREATE TYPE dispute_status AS ENUM (
  'open',
  'under_review',
  'won',
  'lost',
  'accepted',
  'expired'
);

CREATE TYPE kyc_status AS ENUM (
  'not_started',
  'pending',
  'submitted',
  'verified',
  'rejected',
  'expired'
);

CREATE TYPE ledger_entry_type AS ENUM (
  'credit',
  'debit'
);

CREATE TYPE ledger_account_type AS ENUM (
  'patient_payment',
  'platform_revenue',
  'hospital_payable',
  'pharmacy_payable',
  'gateway_fee',
  'gst_collected',
  'tds_deducted',
  'refund_outflow',
  'hold_funds'
);

CREATE TYPE reconciliation_status AS ENUM (
  'pending',
  'matched',
  'mismatched',
  'resolved',
  'write_off'
);

CREATE TYPE webhook_processing_status AS ENUM (
  'received',
  'processing',
  'processed',
  'failed',
  'skipped'
);

CREATE TYPE settlement_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly'
);

-- ======================== PHARMACY ========================

CREATE TYPE medicine_category AS ENUM (
  'tablet', 'capsule', 'syrup', 'injection', 'cream',
  'ointment', 'drops', 'inhaler', 'powder', 'gel', 'other'
);

CREATE TYPE medicine_schedule AS ENUM (
  'otc',
  'schedule_h',
  'schedule_h1',
  'schedule_x',
  'ayurvedic',
  'homeopathic'
);

CREATE TYPE medicine_order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'packed',
  'ready_for_pickup',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned'
);

CREATE TYPE delivery_partner_code AS ENUM (
  'rozx_delivery', 'dunzo', 'shadowfax', 'porter', 'shiprocket'
);

-- ======================== NOTIFICATION ========================

CREATE TYPE notification_type AS ENUM (
  'appointment_booked',
  'appointment_confirmed',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
  'appointment_cancelled',
  'appointment_rescheduled',
  'consultation_started',
  'consultation_ended',
  'waiting_room_ready',
  'payment_success',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  'prescription_ready',
  'medicine_order_confirmed',
  'medicine_dispatched',
  'medicine_delivered',
  'verification_approved',
  'verification_rejected',
  'settlement_processed',
  'payout_completed',
  'dispute_raised',
  'welcome',
  'general'
);

CREATE TYPE notification_channel AS ENUM (
  'sms', 'whatsapp', 'email', 'push', 'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending', 'sent', 'delivered', 'read', 'failed'
);

-- ======================== SUPPORT ========================

CREATE TYPE ticket_status AS ENUM (
  'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low', 'medium', 'high', 'urgent'
);

CREATE TYPE ticket_category AS ENUM (
  'appointment', 'payment', 'refund', 'medicine_order',
  'technical', 'feedback', 'other'
);

-- ======================== DOCUMENT ========================

CREATE TYPE document_type AS ENUM (
  'prescription', 'lab_report', 'imaging', 'medical_certificate',
  'discharge_summary', 'insurance_document', 'vaccination_record', 'other'
);

-- ======================== AUDIT ========================

CREATE TYPE audit_action AS ENUM (
  'create', 'read', 'update', 'delete',
  'login', 'logout', 'payment', 'refund',
  'status_change', 'verification',
  'payout', 'settlement', 'dispute'
);
