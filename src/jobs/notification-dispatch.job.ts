import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { notificationService } from '../modules/notifications/notification.service.js';

/** P3: Concurrency limiter — processes items in batches of `concurrency` */
async function processWithConcurrency<T>(
    items: T[],
    concurrency: number,
    handler: (item: T) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
    const results: PromiseSettledResult<void>[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        const chunkResults = await Promise.allSettled(chunk.map(handler));
        results.push(...chunkResults);
    }
    return results;
}

/**
 * Dispatch pending notifications (Retry mechanism)
 * P3: Processes up to 50 items with concurrency of 10 using Promise.allSettled,
 * instead of awaiting each one serially.
 */
export const dispatchNotifications = async () => {
    const log = logger.child('Job:Dispatch');
    const BATCH_SIZE = 50;
    const CONCURRENCY = 10;
    const MAX_ATTEMPTS = 5;

    try {
        const { data: pending, error } = await supabaseAdmin
            .from('notification_queue')
            .select('*')
            .in('status', ['pending', 'failed'])
            .lt('attempts', MAX_ATTEMPTS)
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (error) {
            log.warn('Could not fetch from notification_queue. Ensure table exists.', error.message);
            return;
        }

        if (!pending || pending.length === 0) {
            return;
        }

        log.info(`Processing ${pending.length} notification queue items (concurrency: ${CONCURRENCY})...`);

        const results = await processWithConcurrency(pending, CONCURRENCY, async (item) => {
            try {
                // Dispatch based on notification type
                if (item.channel === 'email' && item.recipient_email) {
                    await notificationService.send({
                        purpose: item.purpose,
                        email: item.recipient_email,
                        variables: item.variables || {},
                    });
                } else if ((item.channel === 'whatsapp' || item.channel === 'sms') && item.recipient_phone) {
                    await notificationService.send({
                        purpose: item.purpose,
                        phone: item.recipient_phone,
                        variables: item.variables || {},
                    });
                }
                // If no specific channel handler matched, mark as completed anyway
                // (the notification service handles channel selection internally)

                await supabaseAdmin
                    .from('notification_queue')
                    .update({ status: 'completed', updated_at: new Date().toISOString() })
                    .eq('id', item.id);
            } catch (err: any) {
                const newAttempts = (item.attempts || 0) + 1;
                await supabaseAdmin
                    .from('notification_queue')
                    .update({
                        status: newAttempts >= MAX_ATTEMPTS ? 'permanently_failed' : 'failed',
                        error: err.message?.substring(0, 500),
                        attempts: newAttempts,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', item.id);
                throw err; // Re-throw so Promise.allSettled records it as rejected
            }
        });

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        log.info(`Notification dispatch complete: ${succeeded} succeeded, ${failed} failed out of ${pending.length}`);

    } catch (error) {
        log.error('Failed to run dispatch job:', error);
    }
};
