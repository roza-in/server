import type { PaymentProvider, PaymentOrder, PaymentRefund, PaymentOrderStatus, WebhookEvent } from '../payment.types.js';
import { RazorpayService } from './razorpay.service.js';
import { RazorpayWebhook } from './razorpay.webhook.js';
import crypto from 'crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

export class RazorpayProvider implements PaymentProvider {
    readonly name = 'razorpay' as const;
    private log = logger.child('RazorpayProvider');

    // ── Orders ────────────────────────────────────────────────────────────

    async createOrder(data: {
        amount: number;
        currency: string;
        receipt: string;
        notes?: Record<string, string>;
    }): Promise<PaymentOrder> {
        const order = await RazorpayService.createOrder(data);
        return {
            id: order.id,
            amount: Number(order.amount),
            currency: order.currency,
            receipt: order.receipt,
            notes: order.notes,
            provider_order_id: order.id,
        };
    }

    async fetchPayment(paymentId: string): Promise<any> {
        return RazorpayService.fetchPayment(paymentId);
    }

    async fetchOrderStatus(orderId: string): Promise<PaymentOrderStatus> {
        const order = await RazorpayService.fetchOrder(orderId);
        const { items: payments } = await RazorpayService.fetchOrderPayments(orderId);
        const latest = payments?.[0];

        const statusMap: Record<string, PaymentOrderStatus['status']> = {
            paid: 'captured',
            created: 'created',
            attempted: 'pending',
        };

        return {
            id: orderId,
            status: statusMap[order.status] || 'pending',
            method: latest?.method,
            gateway_payment_id: latest?.id,
            raw: { order, payments },
        };
    }

    // ── Refunds ───────────────────────────────────────────────────────────

    async createRefund(
        paymentId: string,
        data: { amount?: number; speed?: 'normal' | 'optimum'; notes?: Record<string, string> },
    ): Promise<PaymentRefund> {
        const refund = await RazorpayService.createRefund(paymentId, data);
        return {
            id: refund.id,
            payment_id: refund.payment_id,
            amount: Number(refund.amount),
            status: refund.status,
            speed: refund.speed,
            notes: refund.notes,
        };
    }

    // ── Signature Verification ────────────────────────────────────────────

    /**
     * Verify Razorpay checkout signature (order_id|payment_id HMAC-SHA256).
     * SECURITY: Timing-safe comparison prevents timing attacks.
     */
    verifySignature(data: { order_id: string; payment_id: string; signature: string }): boolean {
        const secret = env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            this.log.error('RAZORPAY_KEY_SECRET is missing');
            return false;
        }

        if (!data.order_id || !data.payment_id || !data.signature) {
            this.log.error('Missing required arguments for signature verification');
            return false;
        }

        try {
            const generated = crypto
                .createHmac('sha256', secret)
                .update(`${data.order_id}|${data.payment_id}`)
                .digest('hex');

            const generatedBuf = Buffer.from(generated);
            const providedBuf = Buffer.from(data.signature);

            if (generatedBuf.length !== providedBuf.length) return false;
            return crypto.timingSafeEqual(generatedBuf, providedBuf);
        } catch (error) {
            this.log.error('Signature verification failed', error);
            return false;
        }
    }

    /**
     * Verify Razorpay webhook signature — delegates to RazorpayWebhook.
     */
    verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
        return RazorpayWebhook.verifySignature(
            typeof payload === 'string' ? payload : payload.toString('utf8'),
            signature,
        );
    }

    // ── Webhook Parsing ───────────────────────────────────────────────────

    parseWebhookEvent(body: any): WebhookEvent {
        return RazorpayWebhook.parseEvent(body);
    }
}

