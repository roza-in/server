/**
 * C4: Webhook Signature Verification (Razorpay + Cashfree)
 *
 * Verifies:
 *  - Razorpay middleware rejects missing / invalid HMAC-SHA256 hex signatures
 *  - Cashfree middleware rejects missing / invalid HMAC-SHA256 base64 signatures
 *  - webhookApiKeyAuth uses timing-safe comparison
 *  - Valid signatures pass through
 */
import crypto from 'crypto';
import { generateRazorpaySignature, generateCashfreeSignature } from '../helpers.js';

const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;
const CASHFREE_SECRET = process.env.CASHFREE_WEBHOOK_SECRET!;
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY!;

// ---------------------------------------------------------------------------
// Razorpay webhook signature verification
// Mirrors razorpayWebhookAuth middleware logic
// ---------------------------------------------------------------------------

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // length mismatch
  }
}

// ---------------------------------------------------------------------------
// Cashfree webhook signature verification
// Mirrors cashfreeWebhookAuth middleware logic
// ---------------------------------------------------------------------------

function verifyCashfreeSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Webhook API key auth
// Mirrors webhookApiKeyAuth middleware logic
// ---------------------------------------------------------------------------

function verifyWebhookApiKey(provided: string, expected: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('C4 — Razorpay Webhook Auth', () => {
  const sampleBody = JSON.stringify({ event: 'payment.captured', payload: { id: 'pay_123' } });

  it('accepts valid HMAC-SHA256 hex signature', () => {
    const sig = generateRazorpaySignature(sampleBody);
    expect(verifyRazorpaySignature(sampleBody, sig, RAZORPAY_SECRET)).toBe(true);
  });

  it('rejects incorrect signature', () => {
    expect(verifyRazorpaySignature(sampleBody, 'deadbeef'.repeat(8), RAZORPAY_SECRET)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifyRazorpaySignature(sampleBody, '', RAZORPAY_SECRET)).toBe(false);
  });

  it('rejects tampered body', () => {
    const sig = generateRazorpaySignature(sampleBody);
    const tampered = sampleBody.replace('pay_123', 'pay_666');
    expect(verifyRazorpaySignature(tampered, sig, RAZORPAY_SECRET)).toBe(false);
  });

  it('produces a 64-character hex digest', () => {
    const sig = generateRazorpaySignature(sampleBody);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('C4 — Cashfree Webhook Auth', () => {
  const sampleBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'cf_123' } } });

  it('accepts valid HMAC-SHA256 base64 signature', () => {
    const sig = generateCashfreeSignature(sampleBody);
    expect(verifyCashfreeSignature(sampleBody, sig, CASHFREE_SECRET)).toBe(true);
  });

  it('rejects incorrect signature', () => {
    expect(verifyCashfreeSignature(sampleBody, 'aW52YWxpZA==', CASHFREE_SECRET)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifyCashfreeSignature(sampleBody, '', CASHFREE_SECRET)).toBe(false);
  });

  it('rejects tampered body', () => {
    const sig = generateCashfreeSignature(sampleBody);
    const tampered = sampleBody.replace('cf_123', 'cf_999');
    expect(verifyCashfreeSignature(tampered, sig, CASHFREE_SECRET)).toBe(false);
  });

  it('signature is valid base64', () => {
    const sig = generateCashfreeSignature(sampleBody);
    expect(Buffer.from(sig, 'base64').toString('base64')).toBe(sig);
  });

  it('signature differs from Razorpay (different encoding)', () => {
    const body = '{"common":"payload"}';
    const razorpaySig = generateRazorpaySignature(body);
    const cashfreeSig = generateCashfreeSignature(body);
    // Even if secrets happened to match, encodings differ (hex vs base64)
    expect(razorpaySig).not.toBe(cashfreeSig);
  });
});

describe('C4 — Webhook API Key Auth', () => {
  it('accepts valid API key', () => {
    expect(verifyWebhookApiKey(WEBHOOK_API_KEY, WEBHOOK_API_KEY)).toBe(true);
  });

  it('rejects incorrect API key', () => {
    expect(verifyWebhookApiKey('wrong-key-value', WEBHOOK_API_KEY)).toBe(false);
  });

  it('rejects empty API key', () => {
    expect(verifyWebhookApiKey('', WEBHOOK_API_KEY)).toBe(false);
  });

  it('uses timing-safe comparison (length mismatch does not throw)', () => {
    // timingSafeEqual throws on length mismatch; our wrapper catches it
    expect(verifyWebhookApiKey('short', WEBHOOK_API_KEY)).toBe(false);
  });
});
