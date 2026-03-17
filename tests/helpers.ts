/**
 * Shared test helpers — mock factories, token generators, etc.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TEST_JWT_SECRET = process.env.JWT_SECRET!;
export const TEST_RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;
export const TEST_CASHFREE_WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET!;
export const TEST_WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY!;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export interface TestTokenPayload {
  userId: string;
  role: string;
  phone?: string;
  email?: string;
  hospitalId?: string;
  doctorId?: string;
  sessionId?: string;
  type?: 'access' | 'refresh';
}

/**
 * Generate a valid JWT access token for testing.
 */
export function generateTestAccessToken(
  overrides: Partial<TestTokenPayload> = {},
): string {
  const payload: TestTokenPayload = {
    userId: 'user-001',
    role: 'patient',
    phone: '+919999999999',
    sessionId: 'session-001',
    type: 'access',
    ...overrides,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'rozx-test',
    algorithm: 'HS256',
  });
}

/**
 * Generate a valid JWT refresh token for testing.
 */
export function generateTestRefreshToken(
  overrides: Partial<TestTokenPayload> = {},
): string {
  const payload: TestTokenPayload = {
    userId: 'user-001',
    role: 'patient',
    phone: '+919999999999',
    sessionId: 'session-001',
    type: 'refresh',
    ...overrides,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'rozx-test',
    algorithm: 'HS256',
  });
}

// ---------------------------------------------------------------------------
// Webhook signature helpers
// ---------------------------------------------------------------------------

/**
 * Generate a valid Razorpay HMAC-SHA256 signature (hex).
 */
export function generateRazorpaySignature(payload: string | Buffer): string {
  return crypto
    .createHmac('sha256', TEST_RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Generate a valid Cashfree HMAC-SHA256 signature (base64).
 */
export function generateCashfreeSignature(payload: string | Buffer): string {
  return crypto
    .createHmac('sha256', TEST_CASHFREE_WEBHOOK_SECRET)
    .update(payload)
    .digest('base64');
}

// ---------------------------------------------------------------------------
// OTP helpers
// ---------------------------------------------------------------------------

export function hashString(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// Mock user factory
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    phone: '+919999999999',
    email: 'test@rozx.in',
    name: 'Test User',
    role: 'patient',
    is_active: true,
    is_blocked: false,
    phone_verified: true,
    email_verified: false,
    password_hash: '$2b$12$fakehash',
    login_count: 1,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    hospitals: [],
    doctors: [],
    staff: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock appointment factory
// ---------------------------------------------------------------------------

export function createMockAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt-001',
    appointment_number: 'RZX-0001',
    patient_id: 'user-001',
    doctor_id: 'doc-001',
    hospital_id: 'hosp-001',
    scheduled_date: '2026-03-01',
    scheduled_start: '2026-03-01T10:00:00+05:30',
    scheduled_end: '2026-03-01T10:15:00+05:30',
    consultation_type: 'online',
    consultation_fee: 500,
    platform_fee: 0,
    total_amount: 500,
    status: 'pending_payment',
    created_at: new Date().toISOString(),
    patient: { id: 'user-001', name: 'Test Patient', phone: '+919999999999', email: null, avatar_url: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock payment factory
// ---------------------------------------------------------------------------

export function createMockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-001',
    appointment_id: 'apt-001',
    payer_user_id: 'user-001',
    hospital_id: 'hosp-001',
    payment_type: 'consultation',
    base_amount: 500,
    total_amount: 500,
    platform_fee: 0,
    gst_amount: 0,
    net_payable: 500,
    currency: 'INR',
    status: 'pending',
    payment_method: 'upi',
    gateway_provider: 'razorpay',
    gateway_order_id: 'order_test123',
    gateway_payment_id: null,
    gateway_signature: null,
    gateway_response: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
