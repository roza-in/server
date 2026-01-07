import { templates } from "./templates.js";
import { whatsappService } from "./whatsapp.service.js";
import { smsService } from "./sms.service.js";
import { emailService } from "./email.service.js";
import type {
  NotificationPayload,
  NotificationChannel,
} from "./types.js";
import { logger } from "../../common/logger.js";

/**
 * Replace {{variable}} placeholders in templates
 */
function applyTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? "");
}

class NotificationService {
  private log = logger.child("NotificationService");

  /**
   * Send notification using business intent
   * Default order: WhatsApp → SMS → Email
   */
  async send(payload: NotificationPayload): Promise<void> {
    const { purpose, phone, email, variables, channel } = payload;

    const template = templates[purpose];
    if (!template) {
      this.log.error("Template not found for notification purpose", { purpose });
      throw new Error(`NO_TEMPLATE_FOR_${purpose}`);
    }

    this.log.debug("Notification triggered", {
      purpose,
      phone: !!phone,
      email: !!email,
      forcedChannel: channel ?? "auto",
    });

    // Forced channel (explicit)
    if (channel) {
      await this.sendViaChannel(channel, template, phone, email, variables);
      return;
    }

    // 1️⃣ WhatsApp
    if (phone && template.whatsapp) {
      try {
        await whatsappService.sendTemplate(
          phone,
          template.whatsapp,
          Object.values(variables)
        );
        this.log.info("Notification sent via WhatsApp", { purpose, phone });
        return;
      } catch (err) {
        this.log.warn("WhatsApp delivery failed, trying fallback", {
          purpose,
          phone,
        });
      }
    }

    // 2️⃣ SMS
    if (phone && template.sms) {
      try {
        const message = applyTemplate(template.sms, variables);
        await smsService.send(phone, message);
        this.log.info("Notification sent via SMS", { purpose, phone });
        return;
      } catch (err) {
        this.log.warn("SMS delivery failed, trying fallback", {
          purpose,
          phone,
        });
      }
    }

    // 3️⃣ Email
    if (email && template.email) {
      try {
        const subject = applyTemplate(template.email.subject, variables);
        const body = applyTemplate(template.email.body, variables);
        await emailService.send(email, subject, body);
        this.log.info("Notification sent via Email", { purpose, email });
        return;
      } catch (err) {
        this.log.error("Email delivery failed", { purpose, email });
      }
    }

    this.log.error("Notification delivery failed on all channels", {
      purpose,
      phone,
      email,
    });

    throw new Error("NOTIFICATION_DELIVERY_FAILED");
  }

  /**
   * Force send via a specific channel
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    template: any,
    phone?: string,
    email?: string,
    vars: Record<string, string> = {}
  ) {
    this.log.debug("Sending notification via forced channel", { channel });

    switch (channel) {
      case "whatsapp":
        if (!phone || !template.whatsapp) {
          throw new Error("WHATSAPP_NOT_AVAILABLE");
        }
        await whatsappService.sendTemplate(
          phone,
          template.whatsapp,
          Object.values(vars)
        );
        this.log.info("Notification sent via WhatsApp (forced)", { phone });
        return;

      case "sms":
        if (!phone || !template.sms) {
          throw new Error("SMS_NOT_AVAILABLE");
        }
        await smsService.send(phone, applyTemplate(template.sms, vars));
        this.log.info("Notification sent via SMS (forced)", { phone });
        return;

      case "email":
        if (!email || !template.email) {
          throw new Error("EMAIL_NOT_AVAILABLE");
        }
        await emailService.send(
          email,
          applyTemplate(template.email.subject, vars),
          applyTemplate(template.email.body, vars)
        );
        this.log.info("Notification sent via Email (forced)", { email });
        return;

      default:
        throw new Error(`UNSUPPORTED_CHANNEL_${channel}`);
    }
  }
}

export const notificationService = new NotificationService();
