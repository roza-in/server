import { logger } from "../../config/logger.js";
import {
  NotificationPayload,
  NotificationChannel,
  NotificationTemplate,
  NotificationPurpose,
} from "./notification.types.js";
import { templates } from "./notification.templates.js";
import { emailProvider } from "./providers/email.provider.js";
import { smsProvider } from "./providers/sms.provider.js";
import { whatsappService } from "./providers/whatsapp.provider.js";

/**
 * NotificationService (Integration Layer)
 *
 * Central notification dispatcher.
 * - Resolves template by NotificationPurpose
 * - Routes to the correct channel
 * - Applies fallback: WhatsApp  SMS  Email
 * - Interpolates {{variable}} placeholders for SMS/Email
 * - Passes positional whatsappValues to Interakt templates
 */
export class NotificationService {
  private log = logger.child("NotificationService");

  /**
   * Send a notification.
   *
   * @param payload.purpose    - Business intent (maps to a template set)
   * @param payload.channel    - Force a specific channel (skips fallback)
   * @param payload.phone      - Required for WhatsApp / SMS
   * @param payload.email      - Required for Email
   * @param payload.variables  - Named vars for SMS/Email interpolation
   * @param payload.whatsappValues - Positional array for Interakt bodyValues
   */
  async send(payload: NotificationPayload): Promise<void> {
    const { purpose, channel, phone, email, variables = {} } = payload;

    const template = templates[purpose];
    if (!template) {
      this.log.error("Missing notification template", { purpose });
      throw new Error(`MISSING_TEMPLATE:${purpose}`);
    }

    this.log.info("Processing notification", {
      purpose,
      channel: channel ?? "auto",
      hasPhone: !!phone,
      hasEmail: !!email,
    });

    //  Forced channel (no fallback) 
    if (channel) {
      await this.sendToChannel(channel, payload, template);
      return;
    }

    //  Automatic fallback: WhatsApp  SMS  Email 
    const errors: string[] = [];

    // 1 WhatsApp (primary)
    if (phone && template.whatsapp) {
      try {
        await this.sendToChannel(NotificationChannel.WhatsApp, payload, template);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`WhatsApp: ${msg}`);
        this.log.warn("WhatsApp failed, falling back to SMS", { purpose, error: msg });
      }
    }

    // 2 SMS
    if (phone && template.sms) {
      try {
        await this.sendToChannel(NotificationChannel.SMS, payload, template);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`SMS: ${msg}`);
        this.log.warn("SMS failed, falling back to Email", { purpose, error: msg });
      }
    }

    // 3 Email
    if (email && template.email) {
      try {
        await this.sendToChannel(NotificationChannel.Email, payload, template);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Email: ${msg}`);
        this.log.warn("Email failed", { purpose, error: msg });
      }
    }

    //  All channels exhausted
    this.log.error("All notification channels failed", { purpose, phone, email, errors });
    throw new Error(`NOTIFICATION_DELIVERY_FAILED: ${errors.join(" | ")}`);
  }

  /**
   * Route to the correct provider.
   */
  private async sendToChannel(
    channel: NotificationChannel,
    payload: NotificationPayload,
    template: NotificationTemplate,
  ): Promise<void> {
    const { phone, email, variables = {}, whatsappValues } = payload;

    switch (channel) {
      case NotificationChannel.WhatsApp: {
        if (!phone || !template.whatsapp) {
          throw new Error("MISSING_WHATSAPP_CONFIG");
        }
        // Use explicit whatsappValues if provided; else fall back to variable values
        const params = whatsappValues ?? Object.values(variables);
        await whatsappService.sendTemplate(phone, template.whatsapp, params);
        this.log.info("WhatsApp sent", { phone, template: template.whatsapp });
        return;
      }

      case NotificationChannel.SMS: {
        if (!phone || !template.sms) {
          throw new Error("MISSING_SMS_CONFIG");
        }
        const message = this.interpolate(template.sms, variables);
        await smsProvider.send(phone, message);
        this.log.info("SMS sent", { phone });
        return;
      }

      case NotificationChannel.Email: {
        if (!email || !template.email) {
          throw new Error("MISSING_EMAIL_CONFIG");
        }
        const subject = this.interpolate(template.email.subject, variables);
        const body = this.interpolate(template.email.body, variables);
        await emailProvider.send(email, subject, body, body.trimStart().startsWith('<'));
        this.log.info("Email sent", { email });
        return;
      }

      default:
        throw new Error(`UNSUPPORTED_CHANNEL:${channel}`);
    }
  }

  /**
   * Replace {{variable}} placeholders in SMS/Email templates.
   */
  private interpolate(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
  }
}

/** Singleton */
export const notificationService = new NotificationService();
