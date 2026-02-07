import { PaymentProvider, PaymentOrder, PaymentRefund } from '../payment.types.js';
import { logger } from '../../../config/logger.js';
import { CashfreeService } from './cashfree.service.js';
import { CashfreeWebhook } from './cashfree.webhook.js';
import { cashfreeClient } from './cashfree.client.js';

/**
 * Cashfree Payment Provider
 * Implements the PaymentProvider interface for Cashfree Payment Gateway
 */
export class CashfreeProvider implements PaymentProvider {
    name = 'cashfree';
    private log = logger.child('CashfreeProvider');

    async createOrder(data: {
        amount: number;
        currency: string;
        receipt: string;
        notes?: Record<string, string>;
    }): Promise<PaymentOrder> {
        const orderId = data.receipt;
        const redirectBase = cashfreeClient.getRedirectBase();

        try {
            const result = await CashfreeService.createOrder({
                orderId,
                amount: data.amount,
                customerId: data.notes?.patient_id || 'guest',
                customerPhone: data.notes?.contact || '9999999999',
                customerEmail: data.notes?.email,
                returnUrl: `${redirectBase}?order_id=${orderId}`,
                notifyUrl: `${redirectBase}/webhook`,
            });

            return {
                id: orderId,
                amount: data.amount,
                currency: data.currency,
                receipt: data.receipt,
                notes: data.notes,
                provider_order_id: result.cf_order_id,
                payment_link: CashfreeService.getPaymentUrl(result.payment_session_id),
            };
        } catch (error) {
            this.log.error('Cashfree createOrder error', error);
            throw error;
        }
    }

    async fetchPayment(paymentId: string): Promise<any> {
        try {
            // In Cashfree, paymentId is orderId
            const order = await CashfreeService.fetchOrder(paymentId);
            const payments = await CashfreeService.fetchPayments(paymentId);
            const latestPayment = payments?.[0];

            // Map Cashfree status to normalized status
            const statusMap: Record<string, string> = {
                PAID: 'captured',
                ACTIVE: 'created',
                EXPIRED: 'failed',
                CANCELLED: 'cancelled',
            };

            return {
                id: paymentId,
                status: statusMap[order.order_status] || 'pending',
                method: latestPayment?.payment_method?.type || 'unknown',
                cf_order_id: order.cf_order_id,
                cf_payment_id: latestPayment?.cf_payment_id,
                raw: { order, payments },
            };
        } catch (error) {
            this.log.error('Cashfree fetchPayment error', error);
            throw error;
        }
    }

    async createRefund(
        paymentId: string,
        data: {
            amount?: number;
            speed?: 'normal' | 'optimum';
            notes?: Record<string, string>;
        }
    ): Promise<PaymentRefund> {
        const refundId = `REF-${Date.now()}`;

        try {
            const result = await CashfreeService.createRefund({
                orderId: paymentId,
                refundId,
                amount: data.amount || 0,
                note: data.notes?.reason || 'Refund initiated',
            });

            return {
                id: result.refund_id || refundId,
                payment_id: paymentId,
                amount: data.amount || 0,
                status: result.refund_status || 'processed',
                notes: data.notes,
            };
        } catch (error) {
            this.log.error('Cashfree refund error', error);
            throw error;
        }
    }

    /**
     * Verify payment signature from checkout callback
     * Cashfree passes payment data in query params, signature verification is optional
     */
    verifySignature(data: { order_id: string; cf_order_id?: string }): boolean {
        // For Cashfree, checkout verification is done via API call to fetch order status
        // We don't use signature verification for checkout flow like Razorpay
        // Instead, we verify by fetching the order status
        return !!(data.order_id || data.cf_order_id);
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
        return CashfreeWebhook.verifySignature(payload, signature);
    }
}
