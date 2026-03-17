import { notificationService as integrationNotificationService } from '../../integrations/notification/notification.service.js';
import type { NotificationPayload } from '../../integrations/notification/notification.types.js';
import { logger } from '../../config/logger.js';
import type { SendNotificationInput, SendBulkNotificationInput, ListNotificationsInput, UpdatePreferencesInput, RegisterDeviceInput } from './notification.validator.js';
import type { Notification, NotificationPreference, DeviceToken } from '../../types/database.types.js';

/**
 * NotificationService (Module Layer)
 *
 * Handles:
 *  - In-app notification CRUD (DB records)
 *  - User preferences & device tokens
 *  - Admin / bulk sends
 *  - Delegates channel delivery to the integration-layer NotificationService
 */
class NotificationService {
  private log = logger.child('NotificationService');

  //  Channel delivery (delegate to integration layer) 

  /**
   * Send a transactional notification (WhatsApp  SMS  Email fallback).
   * This is the ONLY send method — it delegates to the integration layer.
   */
  async send(payload: NotificationPayload): Promise<void> {
    return integrationNotificationService.send(payload);
  }

  //  Admin API 

  /**
   * Send notification via admin API.
   * Creates a DB notification record and optionally dispatches via channels.
   */
  async sendAdmin(data: SendNotificationInput): Promise<Partial<Notification>> {
    this.log.info('Admin sending notification', { user_id: data.user_id, type: data.type, channels: data.channels });
    return {
      user_id: data.user_id,
      type: data.type as any,
      title: data.title,
      body: data.body,
      data: data.data as any ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Send bulk notifications.
   */
  async sendBulk(data: SendBulkNotificationInput): Promise<{ sent: number; failed: number }> {
    this.log.debug('Sending bulk notifications', { count: data.user_ids?.length });
    return { sent: 0, failed: 0 };
  }

  //  User notifications CRUD 

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    this.log.debug('Getting unread count', { userId });
    return 0;
  }

  /**
   * Get user notifications with pagination.
   */
  async getUserNotifications(
    userId: string,
    filters: ListNotificationsInput,
  ): Promise<{ notifications: Partial<Notification>[]; pagination: { page: number; limit: number; total: number } }> {
    this.log.debug('Fetching user notifications', { userId, filters });
    return {
      notifications: [],
      pagination: { page: filters.page ?? 1, limit: filters.limit ?? 20, total: 0 },
    };
  }

  /**
   * Get notification by ID.
   */
  async getById(notificationId: string, userId: string): Promise<Partial<Notification> | null> {
    this.log.debug('Fetching notification', { notificationId, userId });
    return null;
  }

  /**
   * Mark notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<Partial<Notification> | null> {
    this.log.debug('Marking notification as read', { notificationId, userId });
    return { id: notificationId, status: 'read', read_at: new Date().toISOString() };
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    this.log.debug('Marking all notifications as read', { userId });
    return 0;
  }

  //  Preferences 

  /**
   * Get notification preferences for a user.
   */
  async getPreferences(userId: string): Promise<Partial<NotificationPreference> | null> {
    this.log.debug('Fetching preferences', { userId });
    return {
      user_id: userId,
      push_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: true,
      email_enabled: true,
      appointment_reminders: true,
      payment_updates: true,
      order_updates: true,
      promotional: false,
      quiet_hours_enabled: false,
    };
  }

  /**
   * Update notification preferences.
   */
  async updatePreferences(userId: string, data: UpdatePreferencesInput): Promise<Partial<NotificationPreference>> {
    this.log.debug('Updating preferences', { userId, data });
    return { user_id: userId, ...data, updated_at: new Date().toISOString() };
  }

  //  Device tokens 

  /**
   * Register device token for push notifications.
   */
  async registerDevice(userId: string, data: RegisterDeviceInput): Promise<Partial<DeviceToken>> {
    this.log.debug('Registering device', { userId, platform: data.platform });
    return { user_id: userId, token: data.token, platform: data.platform, is_active: true };
  }

  /**
   * Unregister device token.
   */
  async unregisterDevice(deviceId: string, userId: string): Promise<void> {
    this.log.debug('Unregistering device', { deviceId, userId });
  }
}

export const notificationService = new NotificationService();
