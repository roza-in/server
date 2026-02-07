import { Request, Response } from 'express';
import { userService } from './user.service.js';
import { mapUserToProfile } from './user.mapper.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { UpdateUserInput, BlockUserInput, ListUsersInput } from './user.validator.js';
import { userPolicy } from './user.policy.js';
import { UnauthorizedError } from '../../common/errors/index.js';

/**
 * User Controller - HTTP handlers for user management
 */

/**
 * List users with filters
 * GET /api/v1/users
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;

    // Only admins can list all users
    if (!userPolicy.isAdmin(authUser)) {
        throw new UnauthorizedError('Only administrators can access the user list');
    }

    const filters = req.query as unknown as ListUsersInput;
    const result = await userService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.users, pagination);
});

/**
 * Get user by ID
 * GET /api/v1/users/:userId
 */
export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const authUser = (req as AuthenticatedRequest).user;

    const user = await userService.getById(userId);

    // Check policy
    if (!userPolicy.canView(authUser, user)) {
        throw new UnauthorizedError('You do not have permission to view this profile');
    }

    return sendSuccess(res, user);
});

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;
    const user = await userService.getById(authUser.userId);
    // Use mapper to format profile
    return sendSuccess(res, mapUserToProfile(user));
});

/**
 * Update user
 * PATCH /api/v1/users/:userId
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const authUser = (req as AuthenticatedRequest).user;
    const data = req.body as UpdateUserInput;

    // Check policy
    if (!userPolicy.canUpdate(authUser, { id: userId } as any)) {
        throw new UnauthorizedError('You do not have permission to update this profile');
    }

    const user = await userService.update(userId, data);
    return sendSuccess(res, user, MESSAGES.UPDATED);
});

/**
 * Update current user profile
 * PATCH /api/v1/users/me
 */
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;
    const data = req.body as UpdateUserInput;
    await userService.update(authUser.userId, data);
    // Return formatted profile
    // Re-fetch to get relation data if needed, or pass updated user if complete
    const updatedUser = await userService.getById(authUser.userId);
    return sendSuccess(res, mapUserToProfile(updatedUser), MESSAGES.UPDATED);
});

/**
 * Block user
 * POST /api/v1/users/:userId/block
 */
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { reason } = req.body as BlockUserInput;
    const authUser = (req as AuthenticatedRequest).user;

    // Only admins can block users
    if (!userPolicy.isAdmin(authUser)) {
        throw new UnauthorizedError('Only administrators can block users');
    }

    const user = await userService.block(userId, reason, authUser.userId);
    return sendSuccess(res, user, 'User blocked successfully');
});

/**
 * Unblock user
 * POST /api/v1/users/:userId/unblock
 */
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;

    // Only admins can unblock users
    if (!userPolicy.isAdmin(authUser)) {
        throw new UnauthorizedError('Only administrators can unblock users');
    }

    const { userId } = req.params;
    const user = await userService.unblock(userId);
    return sendSuccess(res, user, 'User unblocked successfully');
});

/**
 * Delete user (soft delete)
 * DELETE /api/v1/users/:userId
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const authUser = (req as AuthenticatedRequest).user;

    // Check policy
    if (!userPolicy.canDelete(authUser)) {
        throw new UnauthorizedError('Only administrators can deactivate users');
    }

    await userService.delete(userId);
    return sendSuccess(res, null, MESSAGES.DELETED);
});

/**
 * Get user statistics
 * GET /api/v1/users/stats
 */
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).user;

    // Only admins can view stats
    if (!userPolicy.isAdmin(authUser)) {
        throw new UnauthorizedError('Only administrators can view statistics');
    }

    const stats = await userService.getStats();
    return sendSuccess(res, stats);
});


