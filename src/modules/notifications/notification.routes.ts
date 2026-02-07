import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
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

/**
 * @route POST /api/v1/notifications/send
 * @desc Send notification to a user (admin only)
 * @access Private (admin)
 */
router.post(
  '/send',
  authMiddleware,
  roleGuard('admin'),
  sendNotification
);

/**
 * @route POST /api/v1/notifications/send-bulk
 * @desc Send bulk notifications (admin only)
 * @access Private (admin)
 */
router.post(
  '/send-bulk',
  authMiddleware,
  roleGuard('admin'),
  sendBulkNotification
);

/**
 * @route GET /api/v1/notifications
 * @desc Get user's notifications
 * @access Private
 */
router.get('/', authMiddleware, listNotifications);

/**
 * @route GET /api/v1/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', authMiddleware, getUnreadCount);

/**
 * @route PATCH /api/v1/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch('/read-all', authMiddleware, markAllAsRead);

/**
 * @route GET /api/v1/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
router.get('/preferences', authMiddleware, getPreferences);

/**
 * @route PATCH /api/v1/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
router.patch(
  '/preferences',
  authMiddleware,
  updatePreferences
);

/**
 * @route POST /api/v1/notifications/devices
 * @desc Register device for push notifications
 * @access Private
 */
router.post(
  '/devices',
  authMiddleware,
  registerDevice
);

/**
 * @route DELETE /api/v1/notifications/devices/:deviceId
 * @desc Unregister device
 * @access Private
 */
router.delete('/devices/:deviceId', authMiddleware, unregisterDevice);

/**
 * @route GET /api/v1/notifications/:notificationId
 * @desc Get notification by ID
 * @access Private
 */
router.get('/:notificationId', authMiddleware, getNotification);

/**
 * @route PATCH /api/v1/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch('/:notificationId/read', authMiddleware, markAsRead);

export const notificationRoutes = router;
export default router;

