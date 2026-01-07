import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
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
} from '../modules/notifications/notification.controller.js';

const router = Router();

/**
 * @route POST /api/v1/notifications/send
 * @desc Send notification to a user (admin only)
 * @access Private (admin)
 */
router.post(
  '/send',
  authenticate,
  requireRole('admin'),
  sendNotification
);

/**
 * @route POST /api/v1/notifications/send-bulk
 * @desc Send bulk notifications (admin only)
 * @access Private (admin)
 */
router.post(
  '/send-bulk',
  authenticate,
  requireRole('admin'),
  sendBulkNotification
);

/**
 * @route GET /api/v1/notifications
 * @desc Get user's notifications
 * @access Private
 */
router.get('/', authenticate, listNotifications);

/**
 * @route GET /api/v1/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread-count', authenticate, getUnreadCount);

/**
 * @route PATCH /api/v1/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch('/read-all', authenticate, markAllAsRead);

/**
 * @route GET /api/v1/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
router.get('/preferences', authenticate, getPreferences);

/**
 * @route PATCH /api/v1/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
router.patch(
  '/preferences',
  authenticate,
  updatePreferences
);

/**
 * @route POST /api/v1/notifications/devices
 * @desc Register device for push notifications
 * @access Private
 */
router.post(
  '/devices',
  authenticate,
  registerDevice
);

/**
 * @route DELETE /api/v1/notifications/devices/:deviceId
 * @desc Unregister device
 * @access Private
 */
router.delete('/devices/:deviceId', authenticate, unregisterDevice);

/**
 * @route GET /api/v1/notifications/:notificationId
 * @desc Get notification by ID
 * @access Private
 */
router.get('/:notificationId', authenticate, getNotification);

/**
 * @route PATCH /api/v1/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch('/:notificationId/read', authenticate, markAsRead);

export const notificationRoutes = router;
