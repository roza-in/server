/**
 * Test Utilities and Helpers
 * 
 * Provides common utilities for testing:
 * - Mock factories
 * - Request/Response builders
 * - Assertion helpers
 */

import { jest, expect } from '@jest/globals';
import type { Request, Response } from 'express';

// ============================================================
// Type for user roles
// ============================================================
type UserRole = 'patient' | 'doctor' | 'hospital' | 'admin';

// ============================================================
// Mock Request/Response Builders
// ============================================================

/**
 * Create a mock Express Request
 */
export const mockRequest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    return {
        body: {},
        params: {},
        query: {},
        headers: {},
        cookies: {},
        ip: '127.0.0.1',
        path: '/test',
        method: 'GET',
        requestId: 'test-request-id',
        startTime: Date.now(),
        ...overrides,
    };
};

/**
 * Create a mock Express Response
 */
export const mockResponse = (): {
    _json: unknown;
    _status: number;
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
    cookie: jest.Mock;
    clearCookie: jest.Mock;
} => {
    const res: any = {
        _json: null,
        _status: 200,
        status: jest.fn().mockImplementation(function (this: any, code: number) {
            this._status = code;
            return this;
        }),
        json: jest.fn().mockImplementation(function (this: any, data: unknown) {
            this._json = data;
            return this;
        }),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis(),
    };
    return res;
};

/**
 * Create a mock next function
 */
export const mockNext = jest.fn();

// ============================================================
// User Mock Factory
// ============================================================

interface MockUserOptions {
    id?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
    name?: string;
    hospitalId?: string;
    doctorId?: string;
}

/**
 * Create a mock user object
 */
export const createMockUser = (options: MockUserOptions = {}) => {
    const id = options.id || 'user-uuid-1234';
    return {
        id,
        email: options.email || 'test@example.com',
        phone: options.phone || '+919876543210',
        role: options.role || 'patient',
        name: options.name || 'Test',
        is_active: true,
        is_blocked: false,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
};

/**
 * Create a mock authenticated request
 */
export const mockAuthenticatedRequest = (
    userOptions: MockUserOptions = {},
    requestOverrides: Record<string, unknown> = {}
): Record<string, unknown> => {
    const user = createMockUser(userOptions);
    return mockRequest({
        ...requestOverrides,
        user: {
            userId: user.id,
            email: user.email,
            role: user.role,
            hospitalId: userOptions.hospitalId,
            doctorId: userOptions.doctorId,
        },
        headers: {
            authorization: 'Bearer test-token',
            ...(requestOverrides.headers as Record<string, unknown> || {}),
        },
    });
};

// ============================================================
// Payment Mock Factory
// ============================================================

/**
 * Create a mock payment object
 */
export const createMockPayment = (overrides: Record<string, unknown> = {}) => {
    return {
        id: 'payment-uuid-1234',
        appointment_id: 'appointment-uuid-1234',
        patient_id: 'user-uuid-1234',
        amount: 50000, // In paise (500 INR)
        currency: 'INR',
        status: 'completed',
        payment_method: 'upi',
        razorpay_order_id: 'order_test123',
        razorpay_payment_id: 'pay_test123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
};

/**
 * Create a mock Razorpay order
 */
export const createMockRazorpayOrder = (overrides: Record<string, unknown> = {}) => {
    return {
        id: 'order_test123',
        entity: 'order',
        amount: 50000,
        amount_paid: 0,
        amount_due: 50000,
        currency: 'INR',
        receipt: 'receipt_123',
        status: 'created',
        attempts: 0,
        created_at: Date.now() / 1000,
        ...overrides,
    };
};

// ============================================================
// Appointment Mock Factory
// ============================================================

/**
 * Create a mock appointment object
 */
export const createMockAppointment = (overrides: Record<string, unknown> = {}) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
        id: 'appointment-uuid-1234',
        appointment_number: 'APT-20260115-0001',
        patient_id: 'user-uuid-1234',
        doctor_id: 'doctor-uuid-1234',
        hospital_id: 'hospital-uuid-1234',
        status: 'confirmed',
        consultation_type: 'in_person',
        scheduled_date: tomorrow.toISOString().split('T')[0],
        scheduled_time: '10:00:00',
        duration_minutes: 15,
        symptoms: 'Test symptoms',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
};

// ============================================================
// Assertion Helpers
// ============================================================

/**
 * Assert that a response has the success format
 */
export const expectSuccessResponse = (res: any, statusCode = 200) => {
    expect(res._status).toBe(statusCode);
    expect(res._json).toHaveProperty('success', true);
    expect(res._json).toHaveProperty('data');
};

/**
 * Assert that a response has the error format
 */
export const expectErrorResponse = (res: any, statusCode: number, errorCode?: string) => {
    expect(res._status).toBe(statusCode);
    expect(res._json).toHaveProperty('success', false);
    if (errorCode) {
        expect(res._json.error).toHaveProperty('code', errorCode);
    }
};

// ============================================================
// Delay Helper
// ============================================================

/**
 * Wait for a specified time (useful for testing async operations)
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
