// @ts-nocheck
import { Request, Response } from 'express';
import { notificationService } from './notification.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../common/response.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  SendNotificationInput,
  SendBulkNotificationInput,
  ListNotificationsInput,
  UpdatePreferencesInput,
  RegisterDeviceInput,
} from './notification.validator.js';

/**
 * Notification Controller - Handles HTTP requests for notifications
 */

/**
 * Send notification (admin only)
 * POST /api/v1/notifications/send
 */
export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as SendNotificationInput;
  const notifications = await notificationService.send(data);
  return sendCreated(res, notifications, 'Notification sent');
});

/**
 * Send bulk notifications (admin only)
 * POST /api/v1/notifications/send-bulk
 */
export const sendBulkNotification = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as SendBulkNotificationInput;
  const result = await notificationService.sendBulk(data);
  return sendSuccess(res, result, `Sent ${result.sent} notifications`);
});

/**
 * Get user notifications
 * GET /api/v1/notifications
 */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = req.query as unknown as ListNotificationsInput;
  const result = await notificationService.getUserNotifications(user.userId, filters);
  return sendPaginated(
    res,
    result.notifications,
    result.pagination.page,
    result.pagination.limit,
    result.pagination.total
  );
});

/**
 * Get notification by ID
 * GET /api/v1/notifications/:notificationId
 */
export const getNotification = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const notification = await notificationService.getById(notificationId, user.userId);
  return sendSuccess(res, notification);
});

/**
 * Mark notification as read
 * PATCH /api/v1/notifications/:notificationId/read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const notification = await notificationService.markAsRead(notificationId, user.userId);
  return sendSuccess(res, notification, 'Marked as read');
});

/**
 * Mark all notifications as read
 * PATCH /api/v1/notifications/read-all
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const count = await notificationService.markAllAsRead(user.userId);
  return sendSuccess(res, { count }, `Marked ${count} notifications as read`);
});

/**
 * Get unread count
 * GET /api/v1/notifications/unread-count
 */
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const count = await notificationService.getUnreadCount(user.userId);
  return sendSuccess(res, { count });
});

/**
 * Get notification preferences
 * GET /api/v1/notifications/preferences
 */
export const getPreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const preferences = await notificationService.getPreferences(user.userId);
  return sendSuccess(res, preferences);
});

/**
 * Update notification preferences
 * PATCH /api/v1/notifications/preferences
 */
export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdatePreferencesInput;
  const preferences = await notificationService.updatePreferences(user.userId, data);
  return sendSuccess(res, preferences, MESSAGES.UPDATED);
});

/**
 * Register device for push notifications
 * POST /api/v1/notifications/devices
 */
export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as RegisterDeviceInput;
  const device = await notificationService.registerDevice(user.userId, data);
  return sendCreated(res, device, 'Device registered');
});

/**
 * Unregister device
 * DELETE /api/v1/notifications/devices/:deviceId
 */
export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await notificationService.unregisterDevice(deviceId, user.userId);
  return sendSuccess(res, null, 'Device unregistered');
});

