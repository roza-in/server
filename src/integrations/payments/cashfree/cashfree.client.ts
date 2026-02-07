import axios from 'axios';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const log = logger.child('CashfreeClient');

/**
 * Cashfree API Client
 * Handles low-level HTTP communication with Cashfree Payment Gateway
 */
class CashfreeClient {
    private baseUrl: string;
    private appId: string;
    private secretKey: string;
    private apiVersion = '2023-08-01';

    constructor() {
        const isProduction = env.CASHFREE_ENV === 'production';
        this.baseUrl = isProduction
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';

        this.appId = env.CASHFREE_APP_ID || '';
        this.secretKey = env.CASHFREE_SECRET_KEY || '';

        if (this.appId && this.secretKey) {
            log.info('CashfreeClient initialized', {
                env: isProduction ? 'production' : 'sandbox',
            });
        }
    }

    /**
     * Get default headers for Cashfree API requests
     */
    private getHeaders() {
        return {
            'x-client-id': this.appId,
            'x-client-secret': this.secretKey,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create a payment order
     */
    async createOrder(data: {
        orderId: string;
        orderAmount: number;
        orderCurrency: string;
        customerPhone: string;
        customerEmail?: string;
        customerId: string;
        returnUrl: string;
        notifyUrl?: string;
    }): Promise<{
        cf_order_id: string;
        order_id: string;
        payment_session_id: string;
        order_status: string;
    }> {
        try {
            const payload = {
                order_id: data.orderId,
                order_amount: data.orderAmount / 100, // Convert paise to rupees
                order_currency: data.orderCurrency || 'INR',
                customer_details: {
                    customer_id: data.customerId,
                    customer_phone: data.customerPhone,
                    customer_email: data.customerEmail || undefined,
                },
                order_meta: {
                    return_url: data.returnUrl,
                    notify_url: data.notifyUrl,
                },
            };

            const response = await axios.post(`${this.baseUrl}/orders`, payload, {
                headers: this.getHeaders(),
                timeout: 30000,
            });

            log.info('Cashfree order created', {
                orderId: data.orderId,
                cfOrderId: response.data.cf_order_id,
            });

            return response.data;
        } catch (error: any) {
            log.error('Cashfree createOrder failed', {
                orderId: data.orderId,
                error: error?.response?.data || error.message,
            });
            throw new Error(
                `CASHFREE_CREATE_ORDER_FAILED: ${error?.response?.data?.message || error.message}`
            );
        }
    }

    /**
     * Fetch order details
     */
    async fetchOrder(orderId: string): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/orders/${orderId}`, {
                headers: this.getHeaders(),
                timeout: 15000,
            });

            return response.data;
        } catch (error: any) {
            log.error('Cashfree fetchOrder failed', {
                orderId,
                error: error?.response?.data || error.message,
            });
            throw new Error(
                `CASHFREE_FETCH_ORDER_FAILED: ${error?.response?.data?.message || error.message}`
            );
        }
    }

    /**
     * Fetch payment details for an order
     */
    async fetchPayments(orderId: string): Promise<any[]> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/orders/${orderId}/payments`,
                {
                    headers: this.getHeaders(),
                    timeout: 15000,
                }
            );

            return response.data;
        } catch (error: any) {
            log.error('Cashfree fetchPayments failed', {
                orderId,
                error: error?.response?.data || error.message,
            });
            throw new Error(
                `CASHFREE_FETCH_PAYMENTS_FAILED: ${error?.response?.data?.message || error.message}`
            );
        }
    }

    /**
     * Create refund
     */
    async createRefund(data: {
        orderId: string;
        refundId: string;
        refundAmount: number;
        refundNote?: string;
    }): Promise<any> {
        try {
            const payload = {
                refund_id: data.refundId,
                refund_amount: data.refundAmount / 100, // Convert paise to rupees
                refund_note: data.refundNote || 'Refund initiated',
            };

            const response = await axios.post(
                `${this.baseUrl}/orders/${data.orderId}/refunds`,
                payload,
                {
                    headers: this.getHeaders(),
                    timeout: 30000,
                }
            );

            log.info('Cashfree refund created', {
                orderId: data.orderId,
                refundId: data.refundId,
            });

            return response.data;
        } catch (error: any) {
            log.error('Cashfree createRefund failed', {
                orderId: data.orderId,
                error: error?.response?.data || error.message,
            });
            throw new Error(
                `CASHFREE_CREATE_REFUND_FAILED: ${error?.response?.data?.message || error.message}`
            );
        }
    }

    /**
     * Get payment link URL for checkout
     */
    getPaymentUrl(paymentSessionId: string): string {
        const isProduction = env.CASHFREE_ENV === 'production';
        const baseCheckoutUrl = isProduction
            ? 'https://payments.cashfree.com/order'
            : 'https://payments-test.cashfree.com/order';

        return `${baseCheckoutUrl}/#${paymentSessionId}`;
    }

    /**
     * Get redirect base URL for callbacks
     */
    getRedirectBase(): string {
        return `${env.CLIENT_URL}/payment/status`;
    }
}

export const cashfreeClient = new CashfreeClient();
