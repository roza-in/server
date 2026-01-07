-- ============================================================
-- ROZX Healthcare Platform - Migration 001
-- Initial Enums Setup
-- Complete enum definitions for the entire platform
-- Created: 2026-01-06
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USER & AUTH ENUMS
-- ============================================================

-- User roles in the system
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'patient',      -- Can book appointments, view prescriptions
      'doctor',       -- Can consult patients, write prescriptions
      'hospital',     -- Hospital admin, manages doctors and schedules
      'admin'         -- ROZX platform admin, full access
    );
  END IF;
END $$;

-- Gender options
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
    CREATE TYPE gender AS ENUM ('male', 'female', 'other');
  END IF;
END $$;

-- Verification status for doctors and hospitals
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM (
      'pending',        -- Awaiting review
      'under_review',   -- Currently being verified
      'verified',       -- Approved and active
      'rejected',       -- Application rejected
      'suspended'       -- Temporarily suspended
    );
  END IF;
END $$;

-- ============================================================
-- HOSPITAL ENUMS
-- ============================================================

-- Hospital types based on PRD
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hospital_type') THEN
    CREATE TYPE hospital_type AS ENUM (
      'multi_specialty',    -- Multi-specialty hospital
      'single_specialty',   -- Single specialty hospital
      'nursing_home',       -- Nursing home
      'clinic',             -- Small clinic
      'diagnostic_center',  -- Diagnostic center with consultation
      'medical_college',    -- Medical college hospital
      'primary_health'      -- Primary health center
    );
  END IF;
END $$;

-- Subscription tiers for hospitals
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM (
      'free',           -- Basic free tier
      'standard',       -- Standard plan
      'premium',        -- Premium with lower fees
      'enterprise'      -- White-label, custom integration
    );
  END IF;
END $$;

-- ============================================================
-- APPOINTMENT & CONSULTATION ENUMS
-- ============================================================

-- Appointment status (comprehensive state machine)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM (
      'pending_payment',  -- Awaiting payment (auto-cancel in 15 min)
      'pending',          -- Payment done, awaiting confirmation
      'confirmed',        -- Confirmed by hospital/doctor
      'checked_in',       -- Patient arrived (in-person)
      'waiting',          -- In waiting room (online)
      'in_progress',      -- Consultation ongoing
      'completed',        -- Consultation done
      'cancelled',        -- Cancelled by patient/doctor/hospital
      'no_show',          -- Patient didn't show up
      'rescheduled'       -- Moved to different slot
    );
  END IF;
END $$;

-- Consultation type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_type') THEN
    CREATE TYPE consultation_type AS ENUM (
      'in_person',    -- Physical visit
      'online',       -- Video consultation
      'phone',        -- Phone consultation (future)
      'home_visit'    -- Doctor visits patient (future)
    );
  END IF;
END $$;

-- Consultation status (for video calls)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
    CREATE TYPE consultation_status AS ENUM (
      'scheduled',      -- Scheduled but not started
      'waiting',        -- Patient in waiting room
      'in_progress',    -- Call ongoing
      'paused',         -- Temporarily paused
      'completed',      -- Call ended normally
      'cancelled',      -- Cancelled
      'failed'          -- Technical failure
    );
  END IF;
END $$;

-- Day of week for schedules
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN
    CREATE TYPE day_of_week AS ENUM (
      'monday', 'tuesday', 'wednesday', 'thursday', 
      'friday', 'saturday', 'sunday'
    );
  END IF;
END $$;

-- ============================================================
-- PAYMENT ENUMS
-- ============================================================

-- Payment status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM (
      'pending',              -- Payment initiated
      'processing',           -- Being processed
      'completed',            -- Successfully completed
      'failed',               -- Payment failed
      'refunded',             -- Fully refunded
      'partially_refunded'    -- Partially refunded
    );
  END IF;
END $$;

-- Refund status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
    CREATE TYPE refund_status AS ENUM (
      'pending',      -- Refund requested
      'processing',   -- Being processed
      'completed',    -- Refund done
      'failed'        -- Refund failed
    );
  END IF;
END $$;

-- Refund type based on PRD cancellation policy
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_type') THEN
    CREATE TYPE refund_type AS ENUM (
      'full',                 -- 100% refund (>24 hrs before)
      'partial_75',           -- 75% refund (12-24 hrs before)
      'partial_50',           -- 50% refund (<12 hrs before)
      'none',                 -- No refund (no-show)
      'doctor_cancelled',     -- Doctor cancelled (100% + credit)
      'technical_failure'     -- Platform failure (100% + free consult)
    );
  END IF;
END $$;

-- Payment method
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM (
      'upi',
      'card',
      'net_banking',
      'wallet',
      'emi',
      'cash'          -- Walk-in payments
    );
  END IF;
END $$;

-- Settlement status for hospital payouts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    CREATE TYPE settlement_status AS ENUM (
      'pending',
      'processing',
      'completed',
      'failed'
    );
  END IF;
END $$;

-- ============================================================
-- NOTIFICATION ENUMS
-- ============================================================

-- Notification types (comprehensive list from PRD)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      -- Appointment related
      'appointment_booked',
      'appointment_confirmed',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_reminder_24h',
      'appointment_reminder_1h',
      'appointment_check_in',
      -- Consultation related
      'consultation_started',
      'consultation_ended',
      'waiting_room_ready',
      -- Payment related
      'payment_success',
      'payment_failed',
      'payment_refund_initiated',
      'payment_refund_completed',
      -- Prescription related
      'prescription_ready',
      'medicine_reminder',
      'refill_reminder',
      -- Follow up related
      'follow_up_reminder',
      'lab_report_ready',
      -- Account related
      'welcome',
      'profile_verified',
      'profile_rejected',
      'password_changed',
      -- Hospital related
      'new_doctor_available',
      'hospital_announcement',
      -- General
      'promotional',
      'health_tip',
      'general'
    );
  END IF;
END $$;

-- Notification channel
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM (
      'sms',
      'whatsapp',
      'email',
      'push',
      'in_app'
    );
  END IF;
END $$;

-- Notification status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM (
      'pending',    -- Not yet sent
      'queued',     -- In queue
      'sent',       -- Sent successfully
      'delivered',  -- Delivered to device
      'read',       -- Seen by user
      'failed'      -- Failed to send
    );
  END IF;
END $$;

-- ============================================================
-- HEALTH RECORDS ENUMS
-- ============================================================

-- Document types for patient health records
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM (
      'prescription',
      'lab_report',
      'imaging',           -- X-ray, CT, MRI, etc.
      'medical_certificate',
      'discharge_summary',
      'insurance_document',
      'vaccination_record',
      'other'
    );
  END IF;
END $$;

-- Blood group enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_group') THEN
    CREATE TYPE blood_group AS ENUM (
      'A+', 'A-', 'B+', 'B-', 
      'AB+', 'AB-', 'O+', 'O-',
      'unknown'
    );
  END IF;
END $$;

-- Family member relationship
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'family_relationship') THEN
    CREATE TYPE family_relationship AS ENUM (
      'self',
      'spouse',
      'child',
      'parent',
      'sibling',
      'grandparent',
      'grandchild',
      'other'
    );
  END IF;
END $$;

-- ============================================================
-- OTP & AUTH ENUMS
-- ============================================================

-- OTP purpose
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_purpose') THEN
    CREATE TYPE otp_purpose AS ENUM (
      'registration',
      'login',
      'password_reset',
      'phone_verification',
      'email_verification',
      'transaction'
    );
  END IF;
END $$;

-- OTP channel
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_channel') THEN
    CREATE TYPE otp_channel AS ENUM (
      'sms',
      'whatsapp',
      'email'
    );
  END IF;
END $$;

-- ============================================================
-- AUDIT ENUMS
-- ============================================================

-- Audit action types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM (
      'create',
      'read',
      'update',
      'delete',
      'login',
      'logout',
      'password_change',
      'verification',
      'payment',
      'refund',
      'export'
    );
  END IF;
END $$;

-- ============================================================
-- END OF MIGRATION 001
-- ============================================================
