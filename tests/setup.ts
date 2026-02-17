/**
 * Jest setup file — runs before all test suites.
 * Sets required environment variables so env.ts Zod validation passes
 * without needing a real .env file.
 */

// Set required env vars BEFORE anything imports env.ts
process.env.NODE_ENV = 'test';
process.env.PORT = '5555';
process.env.SUPABASE_URL = 'https://fake-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-anon-key-that-is-long-enough';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-service-role-key-long-enough';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-with-unique-chars!@#$';
process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = '7d';
process.env.JWT_ISSUER = 'rozx-test';
process.env.COOKIE_SECRET = 'test-cookie-secret-that-is-at-least-32-characters-long-unique!';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
process.env.CASHFREE_WEBHOOK_SECRET = 'test-cashfree-webhook-secret';
process.env.WEBHOOK_API_KEY = 'test-webhook-api-key-that-is-at-least-32-characters-long!!!!';

// Silence logs during tests
import { jest } from '@jest/globals';
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
