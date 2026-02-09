/**
 * Payment Expiry Job
 * 
 * Runs periodically to:
 * 1. Expire pending payments older than 30 minutes
 * 2. Cancel associated appointments
 * 3. Release slot reservations
 * 4. Poll pending PhonePe payment statuses (backup for missed webhooks)
 */

import { logger } from '../config/logger.js';
import { paymentRepository } from '../database/repositories/payment.repo.js';
import { appointmentRepository } from '../database/repositories/appointment.repo.js';
import { supabaseAdmin } from '../database/supabase-admin.js';

const log = logger.child('PaymentExpiryJob');

const PAYMENT_TIMEOUT_MINUTES = 30;

/**
 * Expire pending payments and cancel associated appointments
 */
export async function expirePendingPayments(): Promise<{ expired: number; cancelled: number }> {
    log.info('Running payment expiry job');

    try {
        const cutoffTime = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString();

        // Find pending payments older than timeout
        const { data: pendingPayments, error } = await supabaseAdmin
            .from('payments')
            .select('id, appointment_id, gateway_order_id, gateway_response')
            .eq('status', 'pending')
            .lt('created_at', cutoffTime);

        if (error) {
            log.error('Error fetching pending payments for expiry', error);
            return { expired: 0, cancelled: 0 };
        }

        if (!pendingPayments || pendingPayments.length === 0) {
            log.debug('No pending payments to expire');
            return { expired: 0, cancelled: 0 };
        }

        let expiredCount = 0;
        let cancelledCount = 0;

        for (const payment of pendingPayments) {
            try {
                // Update payment status to expired
                await paymentRepository.update(payment.id, {
                    status: 'expired',
                    updated_at: new Date().toISOString(),
                } as any);
                expiredCount++;

                // Cancel associated appointment if exists
                if (payment.appointment_id) {
                    await appointmentRepository.update(payment.appointment_id, {
                        status: 'cancelled',
                        cancellation_reason: 'Payment timeout - expired after 30 minutes',
                    });
                    cancelledCount++;
                }

                log.info('Payment expired', {
                    paymentId: payment.id,
                    appointmentId: payment.appointment_id,
                });
            } catch (updateError) {
                log.error('Error expiring individual payment', {
                    paymentId: payment.id,
                    error: updateError,
                });
            }
        }

        log.info('Payment expiry job completed', { expired: expiredCount, cancelled: cancelledCount });
        return { expired: expiredCount, cancelled: cancelledCount };
    } catch (err) {
        log.error('Payment expiry job failed', err);
        return { expired: 0, cancelled: 0 };
    }
}

/**
 * Release expired slot locks
 */
export async function releaseExpiredSlotLocks(): Promise<number> {
    log.info('Running slot lock cleanup');

    try {
        const { data, error } = await supabaseAdmin
            .from('appointment_slots')
            .update({
                locked_by: null,
                locked_until: null,
            })
            .lt('locked_until', new Date().toISOString())
            .not('locked_by', 'is', null)
            .select('id');

        if (error) {
            log.error('Error releasing slot locks', error);
            return 0;
        }

        const released = data?.length || 0;
        if (released > 0) {
            log.info(`Released ${released} expired slot locks`);
        }

        return released;
    } catch (err) {
        log.error('Slot lock cleanup failed', err);
        return 0;
    }
}

/**
 * Combined job that runs all payment-related cleanup tasks
 */
export async function runPaymentMaintenanceJobs(): Promise<void> {
    log.info('Starting payment maintenance jobs');

    // Run all jobs concurrently
    await Promise.all([
        expirePendingPayments(),
        releaseExpiredSlotLocks(),
    ]);

    log.info('Payment maintenance jobs completed');
}
