import { cashfreeClient } from './cashfree.client.js';

/**
 * Cashfree Service
 * High-level wrapper for Cashfree payment operations
 */
export class CashfreeService {
    /**
     * Create a payment order
     */
    static async createOrder(data: {
        orderId: string;
        amount: number;
        customerId: string;
        customerPhone: string;
        customerEmail?: string;
        returnUrl: string;
        notifyUrl?: string;
    }) {
        return cashfreeClient.createOrder({
            orderId: data.orderId,
            orderAmount: data.amount,
            orderCurrency: 'INR',
            customerId: data.customerId,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            returnUrl: data.returnUrl,
            notifyUrl: data.notifyUrl,
        });
    }

    /**
     * Fetch order status
     */
    static async fetchOrder(orderId: string) {
        return cashfreeClient.fetchOrder(orderId);
    }

    /**
     * Fetch payments for an order
     */
    static async fetchPayments(orderId: string) {
        return cashfreeClient.fetchPayments(orderId);
    }

    /**
     * Create refund
     */
    static async createRefund(data: {
        orderId: string;
        refundId: string;
        amount: number;
        note?: string;
    }) {
        return cashfreeClient.createRefund({
            orderId: data.orderId,
            refundId: data.refundId,
            refundAmount: data.amount,
            refundNote: data.note,
        });
    }

    /**
     * Get payment URL for checkout
     */
    static getPaymentUrl(paymentSessionId: string): string {
        return cashfreeClient.getPaymentUrl(paymentSessionId);
    }
}
