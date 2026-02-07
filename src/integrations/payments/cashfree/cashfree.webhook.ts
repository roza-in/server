import crypto from 'crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const log = logger.child('CashfreeWebhook');

/**
 * Cashfree Webhook Signature Verification
 * https://docs.cashfree.com/docs/webhooks
 */
export class CashfreeWebhook {
    /**
     * Verify webhook signature using HMAC-SHA256
     * Cashfree sends signature in x-webhook-signature header
     */
    static verifySignature(payload: string | Buffer, signature: string): boolean {
        const webhookSecret = env.CASHFREE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            log.warn('CASHFREE_WEBHOOK_SECRET not configured, skipping verification');
            return false;
        }

        try {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(payload)
                .digest('base64');

            // Use timing-safe comparison to prevent timing attacks
            const expectedBuffer = Buffer.from(expectedSignature);
            const providedBuffer = Buffer.from(signature);

            if (expectedBuffer.length !== providedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
        } catch (error) {
            log.error('Webhook signature verification failed', error);
            return false;
        }
    }

    /**
     * Parse webhook event data
     */
    static parseEvent(body: any): {
        type: string;
        data: {
            order: any;
            payment?: any;
            refund?: any;
        };
    } {
        return {
            type: body.type || 'unknown',
            data: {
                order: body.data?.order || {},
                payment: body.data?.payment,
                refund: body.data?.refund,
            },
        };
    }
}
