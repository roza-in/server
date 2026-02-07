import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
    listUsers,
    getUser,
    getMe,
    updateUser,
    updateMe,
    blockUser,
    unblockUser,
    deleteUser,
    getUserStats,
} from './user.controller.js';

const router = Router();

// ============================================================================
// Protected Routes - All require authentication
// ============================================================================

router.use(authMiddleware);

/**
 * @route GET /api/v1/users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', getMe);

/**
 * @route PATCH /api/v1/users/me
 * @desc Update current user profile
 * @access Private
 */
router.patch('/me', updateMe);

// ============================================================================
// Admin Only Routes
// ============================================================================

/**
 * @route GET /api/v1/users/stats
 * @desc Get user statistics
 * @access Admin
 */
router.get('/stats', roleGuard('admin'), getUserStats);

/**
 * @route GET /api/v1/users
 * @desc List all users with filters
 * @access Admin
 */
router.get('/', roleGuard('admin'), listUsers);

/**
 * @route GET /api/v1/users/:userId
 * @desc Get user by ID
 * @access Admin
 */
router.get('/:userId', roleGuard('admin'), getUser);

/**
 * @route PATCH /api/v1/users/:userId
 * @desc Update user by ID
 * @access Admin
 */
router.patch('/:userId', roleGuard('admin'), updateUser);

/**
 * @route POST /api/v1/users/:userId/block
 * @desc Block a user
 * @access Admin
 */
router.post('/:userId/block', roleGuard('admin'), blockUser);

/**
 * @route POST /api/v1/users/:userId/unblock
 * @desc Unblock a user
 * @access Admin
 */
router.post('/:userId/unblock', roleGuard('admin'), unblockUser);

/**
 * @route DELETE /api/v1/users/:userId
 * @desc Delete (soft) a user
 * @access Admin
 */
router.delete('/:userId', roleGuard('admin'), deleteUser);

export const userRoutes = router;
export default router;

