import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { notificationService } from '../integrations/notification/notification.service.js';
import { NotificationPurpose } from '../integrations/notification/notification.types.js';

/** Simple concurrency limiter — runs at most `limit` async tasks at a time */
const withConcurrency = async <T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> => {
    const results: PromiseSettledResult<void>[] = [];
    let index = 0;

    const run = async (): Promise<void> => {
        while (index < items.length) {
            const i = index++;
            try {
                await fn(items[i]);
                results[i] = { status: 'fulfilled', value: undefined };
            } catch (error) {
                results[i] = { status: 'rejected', reason: error };
            }
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
    await Promise.all(workers);
    return results;
};

/** Max concurrent notification sends to avoid overwhelming the notification service */
const CONCURRENCY_LIMIT = 10;

/**
 * Send reminders for tomorrow's appointments — concurrent with rate limiting
 */
export const sendAppointmentReminders = async () => {
    const log = logger.child('Job:Reminders');
    try {
        log.info('Starting appointment reminders...');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        // Fetch confirmed appointments for tomorrow
        const { data: appointments, error } = await supabaseAdmin
            .from('appointments')
            .select(`
                id,
                scheduled_date,
                scheduled_start,
                patient_id,
                doctor_id,
                doctors (
                    users!doctors_user_id_fkey ( name )
                ),
                patient:users!appointments_patient_id_fkey ( id, phone, email, name )
            `)
            .eq('scheduled_date', dateStr)
            .eq('status', 'confirmed');

        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            log.info('No appointments found for tomorrow.');
            return;
        }

        log.info(`Found ${appointments.length} appointments for tomorrow. Sending reminders concurrently (limit=${CONCURRENCY_LIMIT})...`);

        const results = await withConcurrency(
            appointments as any[],
            CONCURRENCY_LIMIT,
            async (appt: any) => {
                const patientName = appt.patient?.name || 'Patient';
                const doctorName = appt.doctors?.users?.name || 'Doctor';
                const timeStrRaw = appt.scheduled_start || '';
                const time = timeStrRaw.includes('T')
                    ? timeStrRaw.split('T')[1].substring(0, 5)
                    : timeStrRaw.substring(0, 5);

                await notificationService.send({
                    purpose: NotificationPurpose.APPOINTMENT_REMINDER,
                    phone: appt.patient?.phone,
                    email: appt.patient?.email,
                    variables: {
                        patient_name: patientName,
                        doctor_name: doctorName,
                        time,
                        date: dateStr,
                    },
                    whatsappValues: [patientName, doctorName, `${dateStr} at ${time}`],
                });
            },
        );

        const failed = results.filter(r => r.status === 'rejected').length;
        const succeeded = results.length - failed;
        log.info(`Reminder job completed: ${succeeded} sent, ${failed} failed out of ${results.length}`);
    } catch (error) {
        log.error('Failed to run reminder job:', error);
    }
};
