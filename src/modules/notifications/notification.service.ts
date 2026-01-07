import { getSupabaseAdmin } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors.js';
import type { NotificationType, NotificationChannel } from '../../types/database.types.js';
import type {
  Notification,
  NotificationListItem,
  NotificationFilters,
  NotificationListResponse,
  NotificationPreferences,
  UpdatePreferencesInput,
  DeviceToken,
  RegisterDeviceInput,
  SendNotificationInput,
  SendBulkNotificationInput,
  NotificationStats,
  TemplateVariables,
  WhatsAppMessage,
  SMSMessage,
  EmailMessage,
  PushMessage,
  WHATSAPP_TEMPLATES,
} from './notification.types.js';

/**
 * Notification Service - Production-ready multi-channel notifications
 * Features: WhatsApp, SMS, Email, Push, In-App with templates and preferences
 */
class NotificationService {
  private log = logger.child('NotificationService');
  private supabase = getSupabaseAdmin();

  // WhatsApp Business API
  private whatsappApiUrl = `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // ============================================================================
  // Send Notifications
  // ============================================================================

  /**
   * Send notification to single user
   */
  async send(input: SendNotificationInput): Promise<Notification[]> {
    const { user_id, type, channels, variables, data, schedule_at } = input;

    // Get user details
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('id, full_name, phone, email')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      throw new NotFoundError('User');
    }

    // Get user preferences
    const preferences = await this.getPreferences(user_id);

    // Determine channels to use
    const activeChannels = this.getActiveChannels(channels || ['in_app'], preferences, type);

    if (activeChannels.length === 0) {
      this.log.debug('No active channels for notification', { user_id, type });
      return [];
    }

    // Check quiet hours
    if (preferences.quiet_hours_enabled && this.isQuietHours(preferences)) {
      // Schedule for later or skip based on urgency
      if (!this.isUrgentNotification(type)) {
        this.log.debug('Skipping notification due to quiet hours', { user_id, type });
        return [];
      }
    }

    // Send to each channel
    const notifications: Notification[] = [];

    for (const channel of activeChannels) {
      try {
        const notification = await this.sendToChannel(user, channel, type, variables, data);
        notifications.push(notification);
      } catch (error) {
        this.log.error(`Failed to send ${channel} notification`, { error, user_id, type });
      }
    }

    return notifications;
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(input: SendBulkNotificationInput): Promise<{ sent: number; failed: number }> {
    const { user_ids, type, channels, variables, data } = input;

    let sent = 0;
    let failed = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < user_ids.length; i += batchSize) {
      const batch = user_ids.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user_id) => {
          try {
            await this.send({ user_id, type, channels, variables, data });
            sent++;
          } catch (error) {
            failed++;
          }
        })
      );
    }

    this.log.info('Bulk notification completed', { total: user_ids.length, sent, failed });

    return { sent, failed };
  }

  /**
   * Send to specific channel
   */
  private async sendToChannel(
    user: { id: string; full_name: string | null; phone: string; email: string | null },
    channel: NotificationChannel,
    type: NotificationType,
    variables: TemplateVariables,
    data?: Record<string, any>
  ): Promise<Notification> {
    // Get template
    const template = this.getTemplate(type, channel);

    // Render content
    const { title, body } = this.renderTemplate(template, variables);

    // Create notification record
    const { data: notification, error } = await this.supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type,
        channel,
        title,
        body,
        data,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create notification');
    }

    // Send via channel provider
    try {
      let providerResponse: any;

      switch (channel) {
        case 'whatsapp':
          providerResponse = await this.sendWhatsApp(user.phone, type, variables);
          break;
        case 'sms':
          providerResponse = await this.sendSMS(user.phone, body);
          break;
        case 'email':
          if (user.email) {
            providerResponse = await this.sendEmail(user.email, title, body);
          }
          break;
        case 'push':
          providerResponse = await this.sendPush(user.id, title, body, data);
          break;
        case 'in_app':
          // Already saved to database
          providerResponse = { success: true };
          break;
      }

      // Update status
      await this.supabase
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      return { ...notification, status: 'sent', sent_at: new Date().toISOString() };
    } catch (error: any) {
      // Update with error
      await this.supabase
        .from('notifications')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', notification.id);

      throw error;
    }
  }

  // ============================================================================
  // Channel Providers
  // ============================================================================

  /**
   * Send WhatsApp message using templates
   */
  private async sendWhatsApp(
    phone: string,
    type: NotificationType,
    variables: TemplateVariables
  ): Promise<any> {
    const templateName = this.getWhatsAppTemplateName(type);
    const components = this.buildWhatsAppComponents(type, variables);

    const message: WhatsAppMessage = {
      to: this.formatPhoneNumber(phone),
      template: templateName,
      language: 'en',
      components,
    };

    const response = await fetch(this.whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.to,
        type: 'template',
        template: {
          name: message.template,
          language: { code: message.language },
          components: message.components,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.log.error('WhatsApp send failed', error);
      throw new BadRequestError('Failed to send WhatsApp message');
    }

    return response.json();
  }

  /**
   * Send SMS message
   */
  private async sendSMS(phone: string, message: string): Promise<any> {
    // Using generic SMS provider interface
    // Replace with actual provider (Twilio, MSG91, etc.)
    const smsApiUrl = env.SMS_API_URL || 'https://api.sms-provider.com/send';
    const smsApiKey = env.SMS_API_KEY;

    const response = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${smsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: this.formatPhoneNumber(phone),
        message,
        sender_id: env.SMS_SENDER_ID || 'ROZXHC',
      }),
    });

    if (!response.ok) {
      throw new BadRequestError('Failed to send SMS');
    }

    return response.json();
  }

  /**
   * Send email
   */
  private async sendEmail(to: string, subject: string, body: string): Promise<any> {
    // Using generic email provider interface
    // Replace with actual provider (SendGrid, AWS SES, etc.)
    const emailApiUrl = env.EMAIL_API_URL || 'https://api.sendgrid.com/v3/mail/send';
    const emailApiKey = env.EMAIL_API_KEY;

    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.EMAIL_FROM || 'noreply@rozx.in', name: 'ROZX Healthcare' },
        subject,
        content: [
          { type: 'text/html', value: this.wrapEmailHtml(body) },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadRequestError('Failed to send email');
    }

    return { success: true };
  }

  /**
   * Send push notification
   */
  private async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<any> {
    // Get user's device tokens
    const { data: tokens } = await this.supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!tokens || tokens.length === 0) {
      this.log.debug('No device tokens for user', { userId });
      return { success: false, error: 'No device tokens' };
    }

    // Send to FCM (Firebase Cloud Messaging)
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    const fcmKey = env.FCM_SERVER_KEY;

    const results = await Promise.all(
      tokens.map(async ({ token }) => {
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `key=${fcmKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body },
            data: data || {},
          }),
        });

        return response.ok;
      })
    );

    const successCount = results.filter(Boolean).length;
    return { success: successCount > 0, sent: successCount, total: tokens.length };
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get notifications for user
   */
  async list(filters: NotificationFilters): Promise<NotificationListResponse> {
    const {
      user_id,
      type,
      channel,
      status,
      is_read,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = filters;

    let query = this.supabase
      .from('notifications')
      .select('*', { count: 'exact' });

    if (user_id) query = query.eq('user_id', user_id);
    if (channel) query = query.eq('channel', channel);
    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    if (type) {
      if (Array.isArray(type)) {
        query = query.in('type', type);
      } else {
        query = query.eq('type', type);
      }
    }

    if (is_read !== undefined) {
      if (is_read) {
        query = query.not('read_at', 'is', null);
      } else {
        query = query.is('read_at', null);
      }
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch notifications');
    }

    // Get unread count
    const { count: unreadCount } = await this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id!)
      .is('read_at', null);

    const notifications: NotificationListItem[] = (data || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      body: n.body,
      status: n.status,
      read_at: n.read_at,
      created_at: n.created_at,
    }));

    return {
      notifications,
      total: count || 0,
      unread_count: unreadCount || 0,
      page,
      limit,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      throw new BadRequestError('Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('user_id', userId)
      .is('read_at', null)
      .select('id');

    if (error) {
      throw new BadRequestError('Failed to mark notifications as read');
    }

    return data?.length || 0;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      return 0;
    }

    return count || 0;
  }

  // ============================================================================
  // Preferences Operations
  // ============================================================================

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestError('Failed to fetch preferences');
    }

    if (!data) {
      // Create default preferences
      const defaultPrefs = {
        user_id: userId,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        appointment_notifications: true,
        payment_notifications: true,
        reminder_notifications: true,
        promotional_notifications: false,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        digest_mode: false,
        digest_frequency: null,
      };

      const { data: newPrefs, error: createError } = await this.supabase
        .from('notification_preferences')
        .insert(defaultPrefs)
        .select()
        .single();

      if (createError) {
        throw new BadRequestError('Failed to create preferences');
      }

      return newPrefs;
    }

    return data;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      // If doesn't exist, create first
      await this.getPreferences(userId);
      return this.updatePreferences(userId, input);
    }

    return data;
  }

  // ============================================================================
  // Device Token Operations
  // ============================================================================

  /**
   * Register device token
   */
  async registerDevice(userId: string, input: RegisterDeviceInput): Promise<DeviceToken> {
    const { token, platform, device_info } = input;

    // Check if token exists
    const { data: existing } = await this.supabase
      .from('device_tokens')
      .select('id')
      .eq('token', token)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await this.supabase
        .from('device_tokens')
        .update({
          user_id: userId,
          platform,
          device_info,
          is_active: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new BadRequestError('Failed to update device token');
      return data;
    }

    // Create new
    const { data, error } = await this.supabase
      .from('device_tokens')
      .insert({
        user_id: userId,
        token,
        platform,
        device_info,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to register device');
    }

    return data;
  }

  /**
   * Unregister device token
   */
  async unregisterDevice(token: string): Promise<void> {
    await this.supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('token', token);
  }

  // ============================================================================
  // Stats Operations
  // ============================================================================

  /**
   * Get notification stats
   */
  async getStats(userId?: string, dateFrom?: string, dateTo?: string): Promise<NotificationStats> {
    let query = this.supabase.from('notifications').select('status, channel, type');

    if (userId) query = query.eq('user_id', userId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data: notifications } = await query;

    const stats: NotificationStats = {
      total_sent: 0,
      total_delivered: 0,
      total_read: 0,
      total_failed: 0,
      by_channel: {} as Record<NotificationChannel, number>,
      by_type: {} as Record<NotificationType, number>,
      delivery_rate: 0,
      read_rate: 0,
    };

    (notifications || []).forEach((n: any) => {
      if (n.status === 'sent' || n.status === 'delivered' || n.status === 'read') {
        stats.total_sent++;
      }
      if (n.status === 'delivered' || n.status === 'read') {
        stats.total_delivered++;
      }
      if (n.status === 'read') {
        stats.total_read++;
      }
      if (n.status === 'failed') {
        stats.total_failed++;
      }

      stats.by_channel[n.channel as NotificationChannel] =
        (stats.by_channel[n.channel as NotificationChannel] || 0) + 1;
      stats.by_type[n.type as NotificationType] =
        (stats.by_type[n.type as NotificationType] || 0) + 1;
    });

    const total = stats.total_sent + stats.total_failed;
    stats.delivery_rate = total > 0 ? (stats.total_delivered / total) * 100 : 0;
    stats.read_rate = stats.total_delivered > 0 ? (stats.total_read / stats.total_delivered) * 100 : 0;

    return stats;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getActiveChannels(
    requestedChannels: NotificationChannel[],
    preferences: NotificationPreferences,
    type: NotificationType
  ): NotificationChannel[] {
    // Check type preference
    const typeEnabled = this.isTypeEnabled(type, preferences);
    if (!typeEnabled) return [];

    return requestedChannels.filter((channel) => {
      switch (channel) {
        case 'whatsapp':
          return preferences.whatsapp_enabled;
        case 'sms':
          return preferences.sms_enabled;
        case 'email':
          return preferences.email_enabled;
        case 'push':
          return preferences.push_enabled;
        case 'in_app':
          return preferences.in_app_enabled;
        default:
          return false;
      }
    });
  }

  private isTypeEnabled(type: NotificationType, preferences: NotificationPreferences): boolean {
    if (type.startsWith('appointment')) return preferences.appointment_notifications;
    if (type.startsWith('payment')) return preferences.payment_notifications;
    if (type.includes('reminder')) return preferences.reminder_notifications;
    if (type === 'promotional') return preferences.promotional_notifications;
    return true;
  }

  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return currentTime >= preferences.quiet_hours_start && currentTime <= preferences.quiet_hours_end;
  }

  private isUrgentNotification(type: NotificationType): boolean {
    const urgentTypes = ['consultation_starting', 'otp', 'payment_failed'];
    return urgentTypes.includes(type);
  }

  private getTemplate(
    type: NotificationType,
    channel: NotificationChannel
  ): { title: string; body: string } {
    const templates: Record<string, Record<string, { title: string; body: string }>> = {
      appointment_booked: {
        default: {
          title: 'Appointment Confirmed',
          body: 'Your appointment with Dr. {doctor_name} on {appointment_date} at {appointment_time} is confirmed. Booking ID: {booking_id}',
        },
      },
      appointment_reminder: {
        default: {
          title: 'Appointment Reminder',
          body: 'Reminder: You have an appointment with Dr. {doctor_name} on {appointment_date} at {appointment_time}.',
        },
      },
      appointment_cancelled: {
        default: {
          title: 'Appointment Cancelled',
          body: 'Your appointment on {appointment_date} has been cancelled. If you need assistance, please contact us.',
        },
      },
      payment_success: {
        default: {
          title: 'Payment Successful',
          body: 'Payment of ₹{amount} received successfully. Transaction ID: {transaction_id}',
        },
      },
      payment_failed: {
        default: {
          title: 'Payment Failed',
          body: 'Payment of ₹{amount} failed. Please try again or use a different payment method.',
        },
      },
      consultation_starting: {
        default: {
          title: 'Consultation Starting',
          body: 'Your doctor is ready. Please join the consultation now.',
        },
      },
      prescription_ready: {
        default: {
          title: 'Prescription Ready',
          body: 'Your prescription from Dr. {doctor_name} is ready. View it in your ROZX app.',
        },
      },
      otp: {
        default: {
          title: 'Verification Code',
          body: '{otp} is your ROZX verification code. Valid for 10 minutes. Do not share.',
        },
      },
      welcome: {
        default: {
          title: 'Welcome to ROZX!',
          body: 'Welcome to ROZX Healthcare, {patient_name}! Your health journey starts here.',
        },
      },
    };

    return templates[type]?.[channel] || templates[type]?.default || { title: '', body: '{message}' };
  }

  private renderTemplate(
    template: { title: string; body: string },
    variables: TemplateVariables
  ): { title: string; body: string } {
    let title = template.title;
    let body = template.body;

    Object.entries(variables).forEach(([key, value]) => {
      if (value) {
        const regex = new RegExp(`{${key}}`, 'g');
        title = title.replace(regex, value);
        body = body.replace(regex, value);
      }
    });

    return { title, body };
  }

  private getWhatsAppTemplateName(type: NotificationType): string {
    const templateMap: Record<string, string> = {
      otp: 'otp_verification',
      welcome: 'welcome_message',
      appointment_booked: 'appointment_booked',
      appointment_confirmed: 'appointment_confirmed',
      appointment_reminder: 'appointment_reminder_24h',
      appointment_cancelled: 'appointment_cancelled',
      payment_success: 'payment_success',
      consultation_starting: 'consultation_starting',
      prescription_ready: 'prescription_ready',
    };

    return templateMap[type] || 'general_notification';
  }

  private buildWhatsAppComponents(
    type: NotificationType,
    variables: TemplateVariables
  ): any[] {
    // Build components based on template requirements
    const parameters = Object.entries(variables)
      .filter(([_, value]) => value)
      .map(([_, value]) => ({ type: 'text', text: value }));

    if (parameters.length === 0) return [];

    return [
      {
        type: 'body',
        parameters,
      },
    ];
  }

  private formatPhoneNumber(phone: string): string {
    // Ensure phone number is in international format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91')) return cleaned;
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  }

  private wrapEmailHtml(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ROZX Healthcare</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ROZX Healthcare. All rights reserved.</p>
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export const notificationService = new NotificationService();
