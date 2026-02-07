/**
 * Razorpay Mock
 * 
 * Provides mock implementations for Razorpay API calls.
 */

import { jest } from '@jest/globals';
import { createMockRazorpayOrder } from '../utils/test-utils.js';

// Mock Razorpay responses
export const mockRazorpayResponses = {
    createOrder: createMockRazorpayOrder(),
    fetchPayment: {
        id: 'pay_test123',
        entity: 'payment',
        amount: 50000,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
        order_id: 'order_test123',
        captured: true,
        created_at: Date.now() / 1000,
    },
    createRefund: {
        id: 'rfnd_test123',
        entity: 'refund',
        amount: 50000,
        currency: 'INR',
        payment_id: 'pay_test123',
        status: 'processed',
        created_at: Date.now() / 1000,
    },
};

// Mock RazorpayClient
export const mockRazorpayClient = {
    request: jest.fn(),
};

// Mock RazorpayService
export const mockRazorpayService = {
    createOrder: jest.fn().mockResolvedValue(mockRazorpayResponses.createOrder as never),
    fetchPayment: jest.fn().mockResolvedValue(mockRazorpayResponses.fetchPayment as never),
    createRefund: jest.fn().mockResolvedValue(mockRazorpayResponses.createRefund as never),
};

// Setup Razorpay mock
export const setupRazorpayMock = () => {
    jest.mock('../../src/integrations/payments/providers/razorpay/razorpay.client.js', () => ({
        RazorpayClient: mockRazorpayClient,
    }));

    jest.mock('../../src/integrations/payments/providers/razorpay/razorpay.service.js', () => ({
        RazorpayService: mockRazorpayService,
    }));
};

// Helper to simulate Razorpay signature
export const generateMockSignature = (
    orderId: string,
    paymentId: string,
    secret: string = 'test_secret'
): string => {
    const crypto = require('crypto');
    const body = `${orderId}|${paymentId}`;
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
};

// Helper to reset mocks
export const resetRazorpayMocks = () => {
    mockRazorpayClient.request.mockReset();
    mockRazorpayService.createOrder.mockReset().mockResolvedValue(mockRazorpayResponses.createOrder as never);
    mockRazorpayService.fetchPayment.mockReset().mockResolvedValue(mockRazorpayResponses.fetchPayment as never);
    mockRazorpayService.createRefund.mockReset().mockResolvedValue(mockRazorpayResponses.createRefund as never);
};

export default mockRazorpayService;
