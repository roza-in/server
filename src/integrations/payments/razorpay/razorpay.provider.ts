import { PaymentProvider, PaymentOrder, PaymentRefund } from '../payment.types.js';
import { RazorpayService } from './razorpay.service.js';
import crypto from 'crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

export class RazorpayProvider implements PaymentProvider {
    name = 'razorpay';
    private log = logger.child('RazorpayProvider');

    async createOrder(data: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<PaymentOrder> {
        const order = await RazorpayService.createOrder(data);
        return {
            id: order.id,
            amount: Number(order.amount),
            currency: order.currency,
            receipt: order.receipt,
            notes: order.notes,
            provider_order_id: order.id
        };
    }

    async fetchPayment(paymentId: string): Promise<any> {
        return RazorpayService.fetchPayment(paymentId);
    }

    async createRefund(paymentId: string, data: { amount?: number; speed?: 'normal' | 'optimum'; notes?: Record<string, string> }): Promise<PaymentRefund> {
        const refund = await RazorpayService.createRefund(paymentId, data);
        return {
            id: refund.id,
            payment_id: refund.payment_id,
            amount: Number(refund.amount),
            status: refund.status,
            speed: refund.speed,
            notes: refund.notes
        };
    }

    /**
     * Verify Razorpay payment signature (for checkout completion)
     * Uses timing-safe comparison to prevent timing attacks
     */
    verifySignature(data: { order_id: string; payment_id: string; signature: string }): boolean {
        const secret = env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            this.log.error('RAZORPAY_KEY_SECRET is missing');
            return false;
        }

        if (!data.order_id || !data.payment_id || !data.signature) {
            this.log.error('Missing required arguments for signature verification', { data });
            return false;
        }

        try {
            const generated_signature = crypto
                .createHmac('sha256', secret)
                .update(data.order_id + '|' + data.payment_id)
                .digest('hex');

            // SECURITY: Use timing-safe comparison to prevent timing attacks
            const generatedBuffer = Buffer.from(generated_signature);
            const providedBuffer = Buffer.from(data.signature);

            if (generatedBuffer.length !== providedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(generatedBuffer, providedBuffer);
        } catch (error) {
            this.log.error('Signature verification failed', error);
            return false;
        }
    }

    /**
     * Verify Razorpay webhook signature (for server-to-server webhooks)
     * Uses timing-safe comparison to prevent timing attacks
     */
    verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
        const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            this.log.error('RAZORPAY_WEBHOOK_SECRET is missing');
            return false;
        }

        try {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(payload)
                .digest('hex');

            // SECURITY: Use timing-safe comparison
            const expectedBuffer = Buffer.from(expectedSignature);
            const providedBuffer = Buffer.from(signature);

            if (expectedBuffer.length !== providedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
        } catch (error) {
            this.log.error('Webhook signature verification failed', error);
            return false;
        }
    }
}

