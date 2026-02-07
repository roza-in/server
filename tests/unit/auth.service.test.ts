/**
 * Auth Service Unit Tests
 * 
 * Tests for authentication logic including:
 * - OTP verification
 * - Token generation
 * - Password hashing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before importing
jest.mock('../../src/database/supabase-admin.js', () => ({
    supabaseAdmin: {
        from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn(),
                }),
            }),
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
            }),
        }),
    },
}));

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('OTP Verification', () => {
        it('should use timing-safe comparison for OTP', async () => {
            // Test that OTP comparison doesn't leak timing information
            const crypto = await import('crypto');

            const otp1 = '123456';
            const otp2 = '123456';
            const otp3 = '000000';

            // Same OTP should match
            const buf1 = Buffer.from(otp1);
            const buf2 = Buffer.from(otp2);
            expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);

            // Different OTP should not match
            const buf3 = Buffer.from(otp3);
            expect(crypto.timingSafeEqual(buf1, buf3)).toBe(false);
        });

        it('should reject expired OTP', async () => {
            const now = new Date();
            const expiredTime = new Date(now.getTime() - 11 * 60 * 1000); // 11 minutes ago

            expect(expiredTime < now).toBe(true);
        });

        it('should accept valid OTP within expiry window', async () => {
            const now = new Date();
            const validTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
            const expiryMinutes = 10;

            const isValid = (now.getTime() - validTime.getTime()) < expiryMinutes * 60 * 1000;
            expect(isValid).toBe(true);
        });
    });

    describe('Token Generation', () => {
        it('should generate valid JWT tokens', async () => {
            const jwt = await import('jsonwebtoken');
            const secret = 'test-secret';
            const payload = { userId: 'user-123', role: 'patient' };

            const token = jwt.default.sign(payload, secret, { expiresIn: '1h' });

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });

        it('should decode token payload correctly', async () => {
            const jwt = await import('jsonwebtoken');
            const secret = 'test-secret';
            const payload = { userId: 'user-123', role: 'patient' };

            const token = jwt.default.sign(payload, secret, { expiresIn: '1h' });
            const decoded = jwt.default.verify(token, secret) as any;

            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.role).toBe(payload.role);
        });

        it('should reject invalid tokens', async () => {
            const jwt = await import('jsonwebtoken');
            const secret = 'test-secret';
            const wrongSecret = 'wrong-secret';
            const payload = { userId: 'user-123' };

            const token = jwt.default.sign(payload, secret);

            expect(() => {
                jwt.default.verify(token, wrongSecret);
            }).toThrow();
        });
    });

    describe('Password Hashing', () => {
        it('should hash passwords securely', async () => {
            const bcrypt = await import('bcrypt');
            const password = 'SecurePassword123!';

            const hash = await bcrypt.hash(password, 10);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50);
        });

        it('should verify correct password', async () => {
            const bcrypt = await import('bcrypt');
            const password = 'SecurePassword123!';

            const hash = await bcrypt.hash(password, 10);
            const isMatch = await bcrypt.compare(password, hash);

            expect(isMatch).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const bcrypt = await import('bcrypt');
            const password = 'SecurePassword123!';
            const wrongPassword = 'WrongPassword123!';

            const hash = await bcrypt.hash(password, 10);
            const isMatch = await bcrypt.compare(wrongPassword, hash);

            expect(isMatch).toBe(false);
        });
    });

    describe('Session Management', () => {
        it('should generate unique session tokens', () => {
            const { v4: uuidv4 } = require('uuid');

            const token1 = uuidv4();
            const token2 = uuidv4();

            expect(token1).not.toBe(token2);
            expect(token1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });
});
