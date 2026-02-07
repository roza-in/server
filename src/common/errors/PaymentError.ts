import { ApiError } from './ApiError.js';
import { HTTP_STATUS } from '../../config/constants.js';

export class PaymentError extends ApiError {
    constructor(message: string, code: string = 'PAYMENT_ERROR', details?: Record<string, unknown>) {
        super(message, HTTP_STATUS.BAD_REQUEST, code, true, details);
    }
}

export class PaymentFailedError extends PaymentError {
    constructor(reason?: string) {
        super(reason ? `Payment failed: ${reason}` : 'Payment failed', 'PAYMENT_FAILED');
    }
}

export class RefundNotAllowedError extends PaymentError {
    constructor(reason?: string) {
        super(reason ? `Refund not allowed: ${reason}` : 'Refund not allowed', 'REFUND_NOT_ALLOWED');
    }
}
