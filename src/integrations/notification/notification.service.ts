import { logger } from "../../config/logger.js";
import { NotificationPayload, NotificationChannel, NotificationTemplate } from "./notification.types.js";
import { templates } from "./notification.templates.js";
import { emailProvider } from "./providers/email.provider.js";
import { smsProvider } from "./providers/sms.provider.js";
import { whatsappService } from "./providers/whatsapp.provider.js";
import { NotificationPurpose } from "./notification.types.js";

/**
 * NotificationService
 *
 * Responsibilities:
 * - Resolve templates by purpose
 * - Route to correct channel
 * - Apply fallback logic (WhatsApp → SMS → Email)
 * - Interpolate variables
 * - Ensure delivery or fail loudly
 */
export class NotificationService {
    private log = logger.child("NotificationService");

    /**
     * Entry point
     */
    async send(payload: NotificationPayload): Promise<void> {
        const {
            purpose,
            channel,
            phone,
            email,
            variables = {},
        } = payload;

        const template = templates[purpose as NotificationPurpose];

        if (!template) {
            this.log.error("Missing notification template", { purpose });
            throw new Error(`MISSING_TEMPLATE:${purpose}`);
        }

        this.log.info("Processing notification", { purpose, channel, phone, email });

        // 1️⃣ Forced channel (no fallback)
        if (channel) {
            await this.sendToChannel(channel, payload, template);
            return;
        }

        // 2️⃣ Automatic fallback logic
        // WhatsApp → SMS → Email

        // WhatsApp
        if (phone && template.whatsapp) {
            try {
                await this.sendToChannel(NotificationChannel.WhatsApp, payload, template);
                return;
            } catch (err) {
                this.log.warn("WhatsApp failed, falling back to SMS", { purpose, error: err instanceof Error ? err.message : err });
            }
        }

        // SMS
        if (phone && template.sms) {
            try {
                await this.sendToChannel(NotificationChannel.SMS, payload, template);
                return;
            } catch (err) {
                this.log.warn("SMS failed, falling back to Email", { purpose, error: err instanceof Error ? err.message : err });
            }
        }

        // Email
        if (email && template.email) {
            try {
                await this.sendToChannel(NotificationChannel.Email, payload, template);
                return;
            } catch (err) {
                this.log.warn("Email failed", { purpose, error: err instanceof Error ? err.message : err });
            }
        }

        // ❌ Nothing worked
        this.log.error("All notification channels failed", { purpose, phone, email });

        throw new Error("NOTIFICATION_DELIVERY_FAILED_ALL_CHANNELS");
    }

    /**
     * Route to the correct provider
     */
    private async sendToChannel(
        channel: NotificationChannel,
        payload: NotificationPayload,
        template: NotificationTemplate
    ): Promise<void> {
        const { phone, email, variables = {} } = payload;

        switch (channel) {
            case NotificationChannel.WhatsApp: {
                if (!phone || !template.whatsapp) {
                    throw new Error("MISSING_WHATSAPP_CONFIG");
                }

                const params = Object.values(variables);
                await whatsappService.sendTemplate(
                    phone,
                    template.whatsapp,
                    params
                );

                this.log.info("WhatsApp notification sent", { phone });
                return;
            }

            case NotificationChannel.SMS: {
                if (!phone || !template.sms) {
                    throw new Error("MISSING_SMS_CONFIG");
                }

                const message = this.interpolate(template.sms, variables);
                await smsProvider.send(phone, message);

                this.log.info("SMS notification sent", { phone });
                return;
            }

            case NotificationChannel.Email: {
                if (!email || !template.email) {
                    throw new Error("MISSING_EMAIL_CONFIG");
                }

                const subject = this.interpolate(
                    template.email.subject,
                    variables
                );
                const body = this.interpolate(
                    template.email.body,
                    variables
                );

                await emailProvider.send(email, subject, body);

                this.log.info("Email notification sent", { email });
                return;
            }

            default:
                throw new Error(`UNSUPPORTED_NOTIFICATION_CHANNEL:${channel}`);
        }
    }

    /**
     * Replace {{variable}} placeholders in templates
     */
    private interpolate(
        text: string,
        variables: Record<string, string>
    ): string {
        return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return variables[key] ?? `{{${key}}}`;
        });
    }
}

/**
 * Singleton instance
 */
export const notificationService = new NotificationService();
