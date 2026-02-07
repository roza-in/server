import { RazorpayClient } from './razorpay.client.js';

export class RazorpayService {
    static async createOrder(data: {
        amount: number;
        currency: string;
        receipt: string;
        notes?: Record<string, string>;
    }) {
        return RazorpayClient.request('/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async fetchPayment(paymentId: string) {
        return RazorpayClient.request(`/payments/${paymentId}`);
    }

    static async createRefund(paymentId: string, data: {
        amount?: number;
        speed?: 'normal' | 'optimum';
        notes?: Record<string, string>;
    }) {
        return RazorpayClient.request(`/payments/${paymentId}/refund`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}
