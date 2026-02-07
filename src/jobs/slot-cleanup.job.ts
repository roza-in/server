import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';

/**
 * Clean up old schedule overrides (older than 30 days)
 * to keep the table optimized.
 */
export const cleanupOldSlots = async () => {
    const log = logger.child('Job:SlotCleanup');
    try {
        log.info('Starting slot cleanup...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const { error, count } = await supabaseAdmin
            .from('schedule_overrides')
            .delete({ count: 'exact' })
            .lt('override_date', dateStr);

        if (error) {
            throw error;
        }

        log.info(`Slot cleanup completed. Removed ${count} old overrides.`);
    } catch (error) {
        log.error('Failed to cleanup slots:', error);
    }
};
