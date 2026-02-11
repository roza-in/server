import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { notificationService } from '@/modules/notifications/notification.service.js';
import { emailProvider } from '@/integrations/notification/providers/email.provider.js';
import { whatsappService } from '@/integrations/notification/providers/whatsapp.provider.js';
import { NotificationPurpose, NotificationChannel } from '@/integrations/notification/notification.types.js';

// Spies will be set up in beforeEach
// jest.mock is removed to verify interaction with the actual singleton instances
// but we stub the methods.

describe('Notification Service Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(emailProvider, 'send').mockResolvedValue(undefined);
        jest.spyOn(whatsappService, 'sendTemplate').mockResolvedValue(undefined);
    });

    it('should send Appointment Confirmation via WhatsApp', async () => {
        const payload = {
            purpose: NotificationPurpose.APPOINTMENT_CONFIRMED,
            phone: '919415219683',
            channel: NotificationChannel.WhatsApp,
            variables: {
                patient_name: 'Parveen Maurya',
                doctor_name: 'Dr. Mohit Mann',
                date: '15 Jan at 10:30 AM',
                time: '10:30',
                "4": 'online'
            },
            whatsappValues: ['Parveen Maurya', 'Dr. Mohit Mann', '15 Jan at 10:30 AM', 'online']
        };

        await notificationService.send(payload);

        expect(whatsappService.sendTemplate).toHaveBeenCalledWith(
            '919415219683',
            'rozx_appointment_confirmation',
            ['Parveen Maurya', 'Dr. Mohit Mann', '15 Jan at 10:30 AM', 'online']
        );
    });

    it('should send Payment Confirmation via WhatsApp', async () => {
        // Simulating the call from payment.service.ts
        const payload = {
            purpose: NotificationPurpose.PAYMENT_SUCCESS,
            phone: '919415219683',
            channel: NotificationChannel.WhatsApp,
            variables: {
                patient_name: 'Parveen Maurya',
                amount: '500',
                date: '15 Jan at 10:30 AM',
                doctor_name: 'Dr. Mohit Mann'
            },
            whatsappValues: ['Parveen Maurya', '500', '15 Jan at 10:30 AM']
        };

        await notificationService.send(payload);

        expect(whatsappService.sendTemplate).toHaveBeenCalledWith(
            '919415219683',
            'rozx_payment_confirmation',
            ['Parveen Maurya', '500', '15 Jan at 10:30 AM']
        );
    });

    it('should send Appointment Reminder via WhatsApp', async () => {
        // Simulating the call from reminder.job.ts
        const payload = {
            purpose: NotificationPurpose.APPOINTMENT_REMINDER,
            phone: '919415219683',
            channel: NotificationChannel.WhatsApp,
            variables: {
                patient_name: 'Parveen Maurya',
                doctor_name: 'Dr. Mohit Mann',
                time: '10:30',
                date: '2024-01-16'
            },
            whatsappValues: ['Parveen Maurya', 'Dr. Mohit Mann', '2024-01-16 at 10:30']
        };

        await notificationService.send(payload);

        expect(whatsappService.sendTemplate).toHaveBeenCalledWith(
            '919415219683',
            'rozx_appointment_reminder',
            ['Parveen Maurya', 'Dr. Mohit Mann', '2024-01-16 at 10:30']
        );
    });
});
