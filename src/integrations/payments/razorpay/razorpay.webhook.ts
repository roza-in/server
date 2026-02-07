import crypto from 'crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const log = logger.child('RazorpayWebhook');

export class RazorpayWebhook {
    /**
     * Verify Razorpay webhook signature
     * SECURITY: Uses timing-safe comparison to prevent timing attacks
     */
    static verifySignature(payload: string, signature: string): boolean {
        const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            log.error('RAZORPAY_WEBHOOK_SECRET is not configured');
            return false;
        }

        if (!signature) {
            log.warn('Missing X-Razorpay-Signature header');
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
                log.warn('Webhook signature length mismatch');
                return false;
            }

            const isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);

            if (!isValid) {
                log.warn('Webhook signature verification failed');
            }

            return isValid;
        } catch (error) {
            log.error('Webhook signature verification error', error);
            return false;
        }
    }
}

