import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  sendNotificationSchema,
  sendBulkNotificationSchema,
  listNotificationsSchema,
  getNotificationSchema,
  markAsReadSchema,
  updatePreferencesSchema,
  registerDeviceSchema,
  unregisterDeviceSchema,
} from './notification.validator.js';
import {
  sendNotification,
  sendBulkNotification,
  listNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  registerDevice,
  unregisterDevice,
} from './notification.controller.js';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

// ============================================================================
// Admin-only Routes
// ============================================================================

/**
 * @route POST /api/v1/notifications/send
 * @desc Send notification to a user (admin only)
 * @access Private (admin)
 */
router.post(
  '/send',
  roleGuard('admin'),
  validate(sendNotificationSchema),
  sendNotification
);

/**
 * @route POST /api/v1/notifications/send-bulk
 * @desc Send bulk notifications (admin only)
 * @access Private (admin)
 */
router.post(
  '/send-bulk',
  roleGuard('admin'),
  validate(sendBulkNotificationSchema),
  sendBulkNotification
);

// ============================================================================
// User Notification Routes
// ============================================================================

/**
 * @route GET /api/v1/notifications
 * @desc Get user's notifications
 * @access Private
 */
router.get('/', validate(listNotificationsSchema), listNotifications);

/**
 * @route GET /api/v1/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route PATCH /api/v1/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch('/read-all', markAllAsRead);

// ============================================================================
// Preference Routes
// ============================================================================

/**
 * @route GET /api/v1/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
router.get('/preferences', getPreferences);

/**
 * @route PATCH /api/v1/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
router.patch(
  '/preferences',
  validate(updatePreferencesSchema),
  updatePreferences
);

// ============================================================================
// Device Token Routes
// ============================================================================

/**
 * @route POST /api/v1/notifications/devices
 * @desc Register device for push notifications
 * @access Private
 */
router.post(
  '/devices',
  validate(registerDeviceSchema),
  registerDevice
);

/**
 * @route DELETE /api/v1/notifications/devices/:deviceId
 * @desc Unregister device
 * @access Private
 */
router.delete(
  '/devices/:deviceId',
  validate(unregisterDeviceSchema),
  unregisterDevice
);

// ============================================================================
// Single Notification Routes (must be after named routes)
// ============================================================================

/**
 * @route GET /api/v1/notifications/:notificationId
 * @desc Get notification by ID
 * @access Private
 */
router.get('/:notificationId', validate(getNotificationSchema), getNotification);

/**
 * @route PATCH /api/v1/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch('/:notificationId/read', validate(markAsReadSchema), markAsRead);

export const notificationRoutes = router;
export default router;

