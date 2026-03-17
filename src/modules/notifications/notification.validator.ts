import { z } from 'zod';
import { uuidSchema, paginationSchema } from '../../common/validators.js';

/**
 * Notification validators using Zod
 *
 * DB Tables: notifications, notification_preferences, device_tokens,
 *   notification_templates, scheduled_notifications, notification_queue
 *
 * DB Enums:
 *   notification_type (26 values)
 *   notification_channel: sms | whatsapp | email | push | in_app
 *   notification_status: pending | sent | delivered | read | failed
 */

// ============================================================================
// Enum Schemas (aligned with DB enums from migration 001)
// ============================================================================

const notificationTypeEnum = z.enum([
  'appointment_booked',
  'appointment_confirmed',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
  'appointment_cancelled',
  'appointment_rescheduled',
  'consultation_started',
  'consultation_ended',
  'waiting_room_ready',
  'payment_success',
  'payment_failed',
  'refund_initiated',
  'refund_completed',
  'prescription_ready',
  'medicine_order_confirmed',
  'medicine_dispatched',
  'medicine_delivered',
  'verification_approved',
  'verification_rejected',
  'settlement_processed',
  'payout_completed',
  'dispute_raised',
  'welcome',
  'general',
]);

const notificationChannelEnum = z.enum(['sms', 'whatsapp', 'email', 'push', 'in_app']);

const notificationStatusEnum = z.enum(['pending', 'sent', 'delivered', 'read', 'failed']);

// ============================================================================
// Send Notification Schemas
// ============================================================================

export const sendNotificationSchema = z.object({
  body: z.object({
    user_id: uuidSchema,
    type: notificationTypeEnum,
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    action_url: z.string().url().max(500).optional(),
    action_type: z.string().max(50).optional(),
    appointment_id: uuidSchema.optional(),
    medicine_order_id: uuidSchema.optional(),
    payment_id: uuidSchema.optional(),
    channels: z.array(notificationChannelEnum).min(1).default(['in_app']),
  }),
});

export const sendBulkNotificationSchema = z.object({
  body: z.object({
    user_ids: z.array(uuidSchema).min(1).max(1000),
    type: notificationTypeEnum,
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    action_url: z.string().url().max(500).optional(),
    channels: z.array(notificationChannelEnum).min(1).default(['in_app']),
  }),
});

// ============================================================================
// List / Get Schemas
// ============================================================================

export const listNotificationsSchema = z.object({
  query: z.object({
    type: notificationTypeEnum.optional(),
    status: notificationStatusEnum.optional(),
    channel: notificationChannelEnum.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    ...paginationSchema.shape,
  }),
});

export const getNotificationSchema = z.object({
  params: z.object({
    notificationId: uuidSchema,
  }),
});

// ============================================================================
// Read Status Schemas
// ============================================================================

export const markAsReadSchema = z.object({
  params: z.object({
    notificationId: uuidSchema,
  }),
});

// ============================================================================
// Preference Schemas (aligned with notification_preferences table)
// ============================================================================

export const updatePreferencesSchema = z.object({
  body: z.object({
    push_enabled: z.boolean().optional(),
    sms_enabled: z.boolean().optional(),
    whatsapp_enabled: z.boolean().optional(),
    email_enabled: z.boolean().optional(),
    appointment_reminders: z.boolean().optional(),
    payment_updates: z.boolean().optional(),
    order_updates: z.boolean().optional(),
    promotional: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    quiet_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  }),
});

// ============================================================================
// Device Token Schemas (aligned with device_tokens table)
// ============================================================================

export const registerDeviceSchema = z.object({
  body: z.object({
    token: z.string().min(1).max(500),
    platform: z.enum(['ios', 'android', 'web']),
  }),
});

export const unregisterDeviceSchema = z.object({
  params: z.object({
    deviceId: uuidSchema,
  }),
});

// ============================================================================
// Exported Types
// ============================================================================

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>['body'];
export type SendBulkNotificationInput = z.infer<typeof sendBulkNotificationSchema>['body'];
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>['query'];
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>['body'];
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>['body'];



