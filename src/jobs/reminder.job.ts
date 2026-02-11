import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { notificationService } from '../modules/notifications/notification.service.js';

/**
 * Send reminders for tomorrow's appointments
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
                    users ( name )
                ),
                users ( id, phone, email, name )
            `)
            .eq('scheduled_date', dateStr)
            .eq('status', 'confirmed');

        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            log.info('No appointments found for tomorrow.');
            return;
        }

        log.info(`Found ${appointments.length} appointments for tomorrow. Sending reminders...`);

        for (const appt of appointments as any[]) {
            try {
                const patientName = appt.users?.name || 'Patient';
                const doctorName = appt.doctors?.users?.name || 'Doctor';
                // Extract time from scheduled_start (assuming ISO or HH:mm)
                // If it is ISO, split T. If it is time, take substring(0,5)
                const timeStrRaw = appt.scheduled_start || "";
                const time = timeStrRaw.includes('T') ? timeStrRaw.split('T')[1].substring(0, 5) : timeStrRaw.substring(0, 5);

                // Send reminder notification
                await notificationService.send({
                    purpose: 'appointment_reminder' as any, // NotificationPurpose.APPOINTMENT_REMINDER
                    phone: appt.users?.phone,
                    email: appt.users?.email,
                    variables: {
                        patient_name: patientName,
                        doctor_name: doctorName,
                        time: time,
                        date: dateStr
                    },
                    whatsappValues: [patientName, doctorName, `${dateStr} at ${time}`]
                });
            } catch (err) {
                log.error(`Failed to send reminder for appointment ${appt.id}`, err);
            }
        }

        log.info('Reminder job completed.');
    } catch (error) {
        log.error('Failed to run reminder job:', error);
    }
};
