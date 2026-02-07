import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';

/**
 * Mark past 'confirmed' appointments as 'no_show'
 * if they are past their end time.
 */
export const markNoShows = async () => {
    const log = logger.child('Job:NoShow');
    try {
        log.info('Starting No-Show marker...');

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

        // Query logic:
        // 1. Appointment date < today AND status = 'confirmed'
        // OR
        // 2. Appointment date = today AND end_time < now AND status = 'confirmed'

        // Batch 1: Past dates
        const { error: errorPast, count: countPast } = await supabaseAdmin
            .from('appointments')
            .update({ status: 'no_show', updated_at: new Date().toISOString() }, { count: 'exact' })
            .eq('status', 'confirmed')
            .lt('scheduled_date', dateStr);

        if (errorPast) throw errorPast;

        // Batch 2: Today but time passed
        const { error: errorToday, count: countToday } = await supabaseAdmin
            .from('appointments')
            .update({ status: 'no_show', updated_at: new Date().toISOString() }, { count: 'exact' })
            .eq('status', 'confirmed')
            .eq('scheduled_date', dateStr)
            .lt('scheduled_end', now.toISOString());

        if (errorToday) throw errorToday;

        log.info(`No-Show job completed. Marked ${countPast} past dates and ${countToday} from today.`);
    } catch (error) {
        log.error('Failed to mark no-shows:', error);
    }
};
