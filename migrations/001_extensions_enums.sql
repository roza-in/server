-- ============================================================
-- ROZX Healthcare Platform - Migration 001
-- Extensions & Enums (Supabase Ready)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- For encryption

-- ============================================================
-- USER & AUTH ENUMS
-- ============================================================

-- User roles based on finalized responsibilities
CREATE TYPE user_role AS ENUM (
  'patient',     -- End user / consumer
  'reception',   -- Hospital front-desk staff
  'doctor',      -- Medical professional
  'hospital',    -- Hospital owner / manager
  'pharmacy',    -- ROZX pharmacy team
  'admin'        -- Platform super admin
);

CREATE TYPE gender AS ENUM ('male', 'female', 'other');

CREATE TYPE blood_group AS ENUM (
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
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

CREATE TYPE otp_channel AS ENUM ('sms', 'whatsapp', 'email');

-- ============================================================
-- HOSPITAL & DOCTOR ENUMS
-- ============================================================

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
  'monday', 'tuesday', 'wednesday', 'thursday', 
  'friday', 'saturday', 'sunday'
);

CREATE TYPE schedule_override_type AS ENUM (
  'holiday',
  'leave',
  'emergency',
  'special_hours'
);

-- ============================================================
-- APPOINTMENT ENUMS
-- ============================================================

CREATE TYPE consultation_type AS ENUM (
  'online',       -- Video consultation
  'in_person',    -- Physical visit
  'walk_in'       -- Walk-in (booked by reception)
);

CREATE TYPE appointment_status AS ENUM (
  'pending_payment',  -- Waiting for payment
  'confirmed',        -- Payment done, slot booked
  'checked_in',       -- Patient arrived
  'in_progress',      -- Consultation started
  'completed',        -- Consultation done
  'cancelled',        -- Cancelled (with possible refund)
  'no_show',          -- Patient didn't show
  'rescheduled'       -- Moved to another slot
);

CREATE TYPE consultation_status AS ENUM (
  'scheduled',
  'waiting',      -- Patient in waiting room
  'in_progress',
  'paused',
  'completed',
  'failed'
);

CREATE TYPE booking_source AS ENUM (
  'app',          -- Patient self-booking via app
  'web',          -- Patient self-booking via web
  'reception',    -- Booked by hospital reception
  'admin'         -- Booked by admin (rare)
);

-- ============================================================
-- PAYMENT ENUMS
-- ============================================================

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded'
);

CREATE TYPE payment_method AS ENUM (
  'upi',
  'card',
  'net_banking',
  'wallet',
  'cash'          -- For walk-in payments at reception
);

CREATE TYPE payment_type AS ENUM (
  'consultation',     -- Doctor consultation fee
  'medicine_order',   -- Pharmacy order
  'platform_fee'      -- Any platform charges
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
  'admin_override'
);

CREATE TYPE settlement_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================
-- PHARMACY ENUMS (ROZX CENTRAL PHARMACY)
-- ============================================================

CREATE TYPE medicine_category AS ENUM (
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'cream',
  'ointment',
  'drops',
  'inhaler',
  'powder',
  'gel',
  'other'
);

CREATE TYPE medicine_schedule AS ENUM (
  'otc',            -- Over the counter
  'schedule_h',     -- Prescription required
  'schedule_h1',    -- Restricted antibiotics
  'schedule_x',     -- Narcotics (special license)
  'ayurvedic',
  'homeopathic'
);

CREATE TYPE medicine_order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'packed',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned'
);

CREATE TYPE delivery_partner_code AS ENUM (
  'rozx_delivery',  -- ROZX own delivery
  'dunzo',
  'shadowfax',
  'porter',
  'shiprocket'
);

-- ============================================================
-- NOTIFICATION ENUMS
-- ============================================================

CREATE TYPE notification_type AS ENUM (
  -- Appointment
  'appointment_booked',
  'appointment_confirmed',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
  'appointment_cancelled',
  'appointment_rescheduled',
  -- Consultation
  'consultation_started',
  'consultation_ended',
  'waiting_room_ready',
  -- Payment
  'payment_success',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  -- Prescription & Medicine
  'prescription_ready',
  'medicine_order_confirmed',
  'medicine_dispatched',
  'medicine_delivered',
  -- Admin
  'verification_approved',
  'verification_rejected',
  -- General
  'welcome',
  'general'
);

CREATE TYPE notification_channel AS ENUM (
  'sms',
  'whatsapp',
  'email',
  'push',
  'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'read',
  'failed'
);

-- ============================================================
-- SUPPORT ENUMS
-- ============================================================

CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_on_customer',
  'resolved',
  'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE ticket_category AS ENUM (
  'appointment',
  'payment',
  'refund',
  'medicine_order',
  'technical',
  'feedback',
  'other'
);

-- ============================================================
-- DOCUMENT & HEALTH RECORD ENUMS
-- ============================================================

CREATE TYPE document_type AS ENUM (
  'prescription',
  'lab_report',
  'imaging',
  'medical_certificate',
  'discharge_summary',
  'insurance_document',
  'vaccination_record',
  'other'
);

CREATE TYPE family_relationship AS ENUM (
  'self',
  'spouse',
  'parent',
  'child',
  'sibling',
  'other'
);

-- ============================================================
-- AUDIT ENUMS
-- ============================================================

CREATE TYPE audit_action AS ENUM (
  'create',
  'read',
  'update',
  'delete',
  'login',
  'logout',
  'payment',
  'refund',
  'status_change',
  'verification'
);
