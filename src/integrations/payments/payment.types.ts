/**
 * Payment Integration Types
 */

/**
 * Payment order data structure
 */
export interface PaymentOrder {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
    provider_order_id: string;
    payment_link?: string;
}

/**
 * Payment refund data structure
 */
export interface PaymentRefund {
    id: string;
    payment_id: string;
    amount: number;
    status: string;
    speed?: 'normal' | 'optimum';
    notes?: Record<string, string>;
}

/**
 * Payment provider interface
 */
export interface PaymentProvider {
    name: string;
    createOrder(data: {
        amount: number;
        currency: string;
        receipt: string;
        notes?: Record<string, string>
    }): Promise<PaymentOrder>;

    fetchPayment(paymentId: string): Promise<any>;

    createRefund(paymentId: string, data: {
        amount?: number;
        speed?: 'normal' | 'optimum';
        notes?: Record<string, string>
    }): Promise<PaymentRefund>;

    verifySignature?(data: any): boolean;
    verifyWebhookSignature?(payload: string | Buffer, signature: string): boolean;
}

/**
 * Available payment provider names
 */
export type PaymentProviderName = 'razorpay' | 'cashfree';

/**
 * Provider status for health checks/admin
 */
export interface PaymentProviderStatus {
    name: PaymentProviderName;
    enabled: boolean;
    isActive: boolean;
    configured: boolean;
    lastError?: string;
}
