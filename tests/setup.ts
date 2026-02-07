/**
 * Jest Test Setup
 * 
 * This file runs before each test file and sets up:
 * - Environment variables for testing
 * - Global mocks
 * - Extended matchers
 */

import { jest, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.OTP_EXPIRY_MINUTES = '10';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// Silence console in tests unless explicitly debugging
if (process.env.DEBUG_TESTS !== 'true') {
    const originalConsole = global.console;
    global.console = {
        ...originalConsole,
        log: jest.fn() as unknown as typeof console.log,
        debug: jest.fn() as unknown as typeof console.debug,
        info: jest.fn() as unknown as typeof console.info,
        warn: jest.fn() as unknown as typeof console.warn,
        // Keep error for debugging test failures
        error: originalConsole.error,
    };
}

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
    // Add any global cleanup here
});
