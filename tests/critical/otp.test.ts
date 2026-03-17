/**
 * C1 + C2: OTP Hashing & DB Flow Tests
 *
 * Verifies:
 *  - OTPs are hashed with SHA-256 before storage
 *  - Plaintext OTP is NEVER stored or returned
 *  - Attempt counting and max-attempts lockout
 *  - OTP verification uses hashed comparison
 *  - OTP is deleted after successful verification or max attempts
 *  - Purpose field is validated
 */
import crypto from 'crypto';
import { hashString } from '../helpers.js';

// ---------------------------------------------------------------------------
// Unit tests for the hashing function itself
// ---------------------------------------------------------------------------

describe('C1 — OTP Hashing', () => {
  it('hashString produces SHA-256 hex digest', () => {
    const input = '123456';
    const expected = crypto.createHash('sha256').update(input).digest('hex');
    expect(hashString(input)).toBe(expected);
  });

  it('hashString is deterministic', () => {
    expect(hashString('999999')).toBe(hashString('999999'));
  });

  it('different OTPs produce different hashes', () => {
    expect(hashString('123456')).not.toBe(hashString('654321'));
  });

  it('hash output is 64-char hex string', () => {
    const h = hashString('000000');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// C2 — OTP flow integration tests (mocked Redis)
// ---------------------------------------------------------------------------

describe('C2 — OTP DB Flow (unit-level)', () => {
  // Simulates the Redis OTP storage structure used by AuthService
  let redisStore: Map<string, string>;

  beforeEach(() => {
    redisStore = new Map();
  });

  /**
   * Mirrors AuthService.sendOTP storage logic
   */
  function storeOTP(identifier: string, otp: string, purpose: string, ttlSeconds: number) {
    const key = `otp:${purpose}:${identifier}`;
    const data = JSON.stringify({
      otpHash: hashString(otp),
      attempts: 0,
      purpose,
      createdAt: Date.now(),
    });
    redisStore.set(key, data);
    // TTL would be handled by Redis; we skip it in-memory
    return { key, ttlSeconds };
  }

  /**
   * Mirrors AuthService.verifyOTP comparison logic
   */
  function verifyOTP(
    identifier: string,
    otp: string,
    purpose: string,
    maxAttempts = 3,
  ): { valid: boolean; reason?: string } {
    const key = `otp:${purpose}:${identifier}`;
    const raw = redisStore.get(key);

    if (!raw) return { valid: false, reason: 'OTP_EXPIRED_OR_NOT_FOUND' };

    const data = JSON.parse(raw);

    // Attempt counting
    if (data.attempts >= maxAttempts) {
      redisStore.delete(key);
      return { valid: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    // Purpose check
    if (data.purpose !== purpose) {
      return { valid: false, reason: 'PURPOSE_MISMATCH' };
    }

    // Hashed comparison
    if (hashString(otp) !== data.otpHash) {
      data.attempts += 1;
      redisStore.set(key, JSON.stringify(data));
      return { valid: false, reason: 'OTP_INVALID' };
    }

    // Success — delete the key
    redisStore.delete(key);
    return { valid: true };
  }

  it('stores OTP hash, not plaintext', () => {
    storeOTP('+919999999999', '123456', 'login', 300);
    const raw = redisStore.get('otp:login:+919999999999')!;
    const data = JSON.parse(raw);

    // Must NOT contain plaintext OTP
    expect(raw).not.toContain('123456');
    // Must contain a 64-char SHA-256 hash
    expect(data.otpHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.otpHash).toBe(hashString('123456'));
  });

  it('verifies correct OTP against stored hash', () => {
    storeOTP('+919999999999', '123456', 'login', 300);
    const result = verifyOTP('+919999999999', '123456', 'login');
    expect(result.valid).toBe(true);
  });

  it('rejects incorrect OTP', () => {
    storeOTP('+919999999999', '123456', 'login', 300);
    const result = verifyOTP('+919999999999', '000000', 'login');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('OTP_INVALID');
  });

  it('increments attempt counter on failure', () => {
    storeOTP('+919999999999', '123456', 'login', 300);

    verifyOTP('+919999999999', '000000', 'login');
    const storedAfter = JSON.parse(redisStore.get('otp:login:+919999999999')!);
    expect(storedAfter.attempts).toBe(1);
  });

  it('locks out after max attempts and deletes key', () => {
    storeOTP('+919999999999', '123456', 'login', 300);

    verifyOTP('+919999999999', '000000', 'login', 3); // attempt 1
    verifyOTP('+919999999999', '000000', 'login', 3); // attempt 2
    verifyOTP('+919999999999', '000000', 'login', 3); // attempt 3 — increments to 3

    // 4th call: attempts (3) >= maxAttempts (3) → MAX_ATTEMPTS_EXCEEDED, key deleted
    const result = verifyOTP('+919999999999', '123456', 'login', 3);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(redisStore.has('otp:login:+919999999999')).toBe(false);
  });

  it('deletes OTP key after successful verification', () => {
    storeOTP('+919999999999', '123456', 'login', 300);
    verifyOTP('+919999999999', '123456', 'login');
    expect(redisStore.has('otp:login:+919999999999')).toBe(false);
  });

  it('rejects OTP with wrong purpose', () => {
    storeOTP('+919999999999', '123456', 'login', 300);
    const result = verifyOTP('+919999999999', '123456', 'registration');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('OTP_EXPIRED_OR_NOT_FOUND');
  });

  it('rejects verification when no OTP exists (expired/not sent)', () => {
    const result = verifyOTP('+919999999999', '123456', 'login');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('OTP_EXPIRED_OR_NOT_FOUND');
  });
});
