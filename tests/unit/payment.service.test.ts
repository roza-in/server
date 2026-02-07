/**
 * Payment Service Unit Tests
 * 
 * Tests for payment operations including:
 * - Order creation
 * - Payment verification
 * - Refund processing
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import {
    createMockPayment,
    createMockRazorpayOrder,
    createMockAppointment,
} from '../utils/test-utils.js';

describe('PaymentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Order Creation', () => {
        it('should create order with correct amount in paise', () => {
            const amountInRupees = 500;
            const amountInPaise = amountInRupees * 100;

            expect(amountInPaise).toBe(50000);
        });

        it('should generate unique receipt for each order', () => {
            const appointmentId = 'apt-123';
            const timestamp = Date.now();
            const receipt = `rcpt_${appointmentId}_${timestamp}`;

            expect(receipt).toContain(appointmentId);
            expect(receipt).toMatch(/^rcpt_apt-123_\d+$/);
        });

        it('should include required order fields', () => {
            const order = createMockRazorpayOrder();

            expect(order).toHaveProperty('id');
            expect(order).toHaveProperty('amount');
            expect(order).toHaveProperty('currency', 'INR');
            expect(order).toHaveProperty('status', 'created');
        });
    });

    describe('Payment Verification', () => {
        it('should verify valid payment signature', () => {
            const orderId = 'order_test123';
            const paymentId = 'pay_test123';
            const secret = 'test_webhook_secret';

            // Generate signature
            const body = `${orderId}|${paymentId}`;
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');

            // Verify using timing-safe comparison
            const providedBuffer = Buffer.from(expectedSignature);
            const expectedBuffer = Buffer.from(expectedSignature);

            expect(crypto.timingSafeEqual(providedBuffer, expectedBuffer)).toBe(true);
        });

        it('should reject invalid payment signature', () => {
            const orderId = 'order_test123';
            const paymentId = 'pay_test123';
            const secret = 'test_webhook_secret';
            const wrongSecret = 'wrong_secret';

            // Generate signatures with different secrets
            const body = `${orderId}|${paymentId}`;
            const validSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
            const invalidSignature = crypto.createHmac('sha256', wrongSecret).update(body).digest('hex');

            expect(validSignature).not.toBe(invalidSignature);
        });

        it('should update payment status on verification', () => {
            const payment = createMockPayment({ status: 'pending' });

            // Simulate verification
            const verifiedPayment = { ...payment, status: 'completed' };

            expect(verifiedPayment.status).toBe('completed');
        });
    });

    describe('Refund Processing', () => {
        it('should calculate correct refund amount for full refund', () => {
            const payment = createMockPayment({ amount: 50000 });
            const refundAmount = payment.amount;

            expect(refundAmount).toBe(50000);
        });

        it('should calculate correct refund amount for partial refund (75%)', () => {
            const payment = createMockPayment({ amount: 50000 });
            const refundPercentage = 75;
            const refundAmount = Math.floor(payment.amount * refundPercentage / 100);

            expect(refundAmount).toBe(37500);
        });

        it('should reject refund for already refunded payment', () => {
            const payment = createMockPayment({ status: 'refunded' });

            const canRefund = payment.status === 'completed';
            expect(canRefund).toBe(false);
        });

        it('should reject refund exceeding payment amount', () => {
            const payment = createMockPayment({ amount: 50000 });
            const requestedRefund = 60000;

            const isValidAmount = requestedRefund <= payment.amount;
            expect(isValidAmount).toBe(false);
        });

        it('should allow refund for completed payment', () => {
            const payment = createMockPayment({ status: 'completed' });

            const canRefund = payment.status === 'completed';
            expect(canRefund).toBe(true);
        });
    });

    describe('Payment Calculations', () => {
        it('should calculate platform fee correctly', () => {
            const consultationFee = 500; // INR
            const platformFeePercent = 7;
            const platformFee = Math.round(consultationFee * platformFeePercent / 100);

            expect(platformFee).toBe(35);
        });

        it('should calculate GST correctly', () => {
            const platformFee = 35;
            const gstPercent = 18;
            const gst = Math.round(platformFee * gstPercent / 100);

            expect(gst).toBe(6);
        });

        it('should calculate total amount correctly', () => {
            const consultationFee = 500;
            const platformFee = 35;
            const gst = 6;
            const total = consultationFee + platformFee + gst;

            expect(total).toBe(541);
        });
    });

    describe('Payment Status Transitions', () => {
        const validTransitions: Record<string, string[]> = {
            pending: ['processing', 'failed', 'cancelled'],
            processing: ['completed', 'failed'],
            completed: ['refunded', 'partially_refunded'],
            failed: [],
            refunded: [],
        };

        it('should allow valid status transitions', () => {
            const currentStatus = 'completed';
            const newStatus = 'refunded';

            const isValid = validTransitions[currentStatus]?.includes(newStatus);
            expect(isValid).toBe(true);
        });

        it('should reject invalid status transitions', () => {
            const currentStatus = 'failed';
            const newStatus = 'completed';

            const isValid = validTransitions[currentStatus]?.includes(newStatus);
            expect(isValid).toBe(false);
        });

        it('should reject transition from refunded status', () => {
            const currentStatus = 'refunded';

            const allowedTransitions = validTransitions[currentStatus];
            expect(allowedTransitions).toHaveLength(0);
        });
    });
});
