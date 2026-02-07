// @ts-nocheck
import { z } from 'zod';
import { uuidSchema } from '../../common/validators.js';

/**
 * Notification validators using Zod
 */

// Notification type enum
const notificationTypeEnum = z.enum([
  'appointment_booked',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_reminder',
  'payment_success',
  'payment_failed',
  'payment_refund',
  'prescription_ready',
  'consultation_started',
  'follow_up_reminder',
  'welcome',
  'profile_verified',
  'general',
]);

// Notification channel enum
const notificationChannelEnum = z.enum(['sms', 'whatsapp', 'email', 'push', 'in_app']);

// Notification status enum
const notificationStatusEnum = z.enum(['pending', 'sent', 'delivered', 'failed', 'read']);

// Send notification schema
export const sendNotificationSchema = z.object({
  body: z.object({
    userId: uuidSchema,
    type: notificationTypeEnum,
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    channels: z.array(notificationChannelEnum).default(['in_app']),
  }),
});

// Send bulk notification schema
export const sendBulkNotificationSchema = z.object({
  body: z.object({
    userIds: z.array(uuidSchema).min(1).max(1000),
    type: notificationTypeEnum,
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    data: z.record(z.string(), z.any()).optional(),
    channels: z.array(notificationChannelEnum).default(['in_app']),
  }),
});

// List notifications schema
export const listNotificationsSchema = z.object({
  query: z.object({
    type: notificationTypeEnum.optional(),
    status: notificationStatusEnum.optional(),
    channel: notificationChannelEnum.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// Get notification schema
export const getNotificationSchema = z.object({
  params: z.object({
    notificationId: uuidSchema,
  }),
});

// Mark as read schema
export const markAsReadSchema = z.object({
  params: z.object({
    notificationId: uuidSchema,
  }),
});

// Mark all as read schema
export const markAllAsReadSchema = z.object({
  // No specific params needed - uses authenticated user
});

// Update preferences schema
export const updatePreferencesSchema = z.object({
  body: z.object({
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    appointmentReminders: z.boolean().optional(),
    paymentAlerts: z.boolean().optional(),
    promotions: z.boolean().optional(),
  }),
});

// Register device schema
export const registerDeviceSchema = z.object({
  body: z.object({
    token: z.string().min(1).max(500),
    platform: z.enum(['ios', 'android', 'web']),
  }),
});

// Unregister device schema
export const unregisterDeviceSchema = z.object({
  params: z.object({
    deviceId: uuidSchema,
  }),
});

// Export types
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>['body'];
export type SendBulkNotificationInput = z.infer<typeof sendBulkNotificationSchema>['body'];
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>['query'];
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>['body'];
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>['body'];


