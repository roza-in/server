import { templates } from "../../integrations/notification/notification.templates.js";
import type { NotificationPayload, NotificationChannel } from "./notification.types.js";
import { logger } from "../../config/logger.js";
import { emailProvider } from "../../integrations/notification/providers/email.provider.js";

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

    // Normalize purpose to lowercase to match template keys
    const normalizedPurpose = purpose.toLowerCase();
    const template = templates[normalizedPurpose as keyof typeof templates];
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
        // await whatsappService.sendTemplate(
        //   phone,
        //   template.whatsapp,
        //   Object.values(variables)
        // );
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
        // await smsService.send(phone, message);
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
        await emailProvider.send(email, subject, body);
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
    this.log.debug("Sending notification via forced channel", {
      channel,
      hasWhatsappTemplate: !!template?.whatsapp,
      hasSmsTemplate: !!template?.sms,
      hasEmailTemplate: !!template?.email,
    });

    switch (channel) {
      case "whatsapp":
        if (!phone) {
          this.log.error("WhatsApp send failed: missing phone");
          throw new Error("WHATSAPP_NOT_AVAILABLE");
        }
        if (!template.whatsapp) {
          this.log.error("WhatsApp send failed: template name undefined (configure env WHATSAPP_TEMPLATE_OTP_*)");
          throw new Error("WHATSAPP_NOT_AVAILABLE");
        }
        // await whatsappService.sendTemplate(
        //   phone,
        //   template.whatsapp,
        //   Object.values(vars)
        // );
        this.log.info("Notification sent via WhatsApp (forced)", {
          phone,
          templateName: template.whatsapp,
        });
        return;

      case "sms":
        if (!phone || !template.sms) {
          throw new Error("SMS_NOT_AVAILABLE");
        }
        // await smsService.send(phone, applyTemplate(template.sms, vars));
        this.log.info("Notification sent via SMS (forced)", { phone });
        return;

      case "email":
        if (!email || !template.email) {
          throw new Error("EMAIL_NOT_AVAILABLE");
        }
        await emailProvider.send(
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
  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    // TODO: Implement actual database count
    this.log.debug("Getting unread count", { userId });
    return 0;
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(data: any): Promise<any> {
    // TODO: Implement bulk send logic
    this.log.debug("Sending bulk notifications", { count: data.recipients?.length });
    return { sent: 0, failed: 0 };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, filters: any): Promise<any> {
    // TODO: Implement fetching notifications from DB
    this.log.debug("Fetching user notifications", { userId, filters });
    return {
      notifications: [],
      pagination: {
        page: Number(filters.page) || 1,
        limit: Number(filters.limit) || 10,
        total: 0
      }
    };
  }

  /**
   * Get notification by ID
   */
  async getById(notificationId: string, userId: string): Promise<any> {
    // TODO: Implement logic
    return { id: notificationId, userId };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    // TODO: Implement logic
    return { id: notificationId, read: true };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    // TODO: Implement logic
    return 0;
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<any> {
    // TODO: Implement logic
    return { email: true, sms: true, whatsapp: true };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, data: any): Promise<any> {
    // TODO: Implement logic
    return { ...data, userId };
  }

  /**
   * Register device
   */
  async registerDevice(userId: string, data: any): Promise<any> {
    // TODO: Implement logic
    return { ...data, userId, id: 'device-id' };
  }

  /**
   * Unregister device
   */
  async unregisterDevice(deviceId: string, userId: string): Promise<void> {
    // TODO: Implement logic
    this.log.debug("Unregistering device", { deviceId, userId });
  }
}

export const notificationService = new NotificationService();

