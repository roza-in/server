import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type { UserRole } from '../../types/database.types.js';
import type { UserFilters, UserListResponse, UserStats, UserListItem } from './user.types.js';
import type { UpdateUserInput } from './user.validator.js';
import { userRepository } from '../../database/repositories/user.repo.js';

/**
 * User Service - Domain module for user management
 */
class UserService {
    private log = logger.child('UserService');

    /**
     * List users with filters and pagination
     */
    async list(filters: UserFilters): Promise<UserListResponse> {
        try {
            const page = filters.page || 1;
            const limit = Math.min(filters.limit || 20, 100);

            const result = await userRepository.findMany(filters, page, limit);

            const users: UserListItem[] = result.data.map(u => ({
                id: u.id,
                name: u.name || 'User',
                email: u.email || '',
                phone: u.phone,
                avatar_url: u.avatar_url,
                role: u.role,
                is_active: u.is_active || false,
                is_blocked: u.is_blocked || false,
                created_at: u.created_at || new Date().toISOString(),
                last_login_at: u.last_login_at,
            }));

            return {
                users,
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
            };
        } catch (error) {
            this.log.error('Failed to list users', error);
            throw new BadRequestError('Failed to list users');
        }
    }

    /**
     * Get user by ID with full details
     */
    async getById(userId: string): Promise<any> {
        const user = await userRepository.findWithDetails(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    }

    /**
     * Update user profile
     */
    async update(userId: string, updateData: UpdateUserInput): Promise<any> {
        try {
            return await userRepository.updateProfile(userId, {
                ...updateData,
                updated_at: new Date().toISOString(),
            } as any);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            this.log.error('Failed to update user', error);
            throw new BadRequestError('Failed to update user');
        }
    }

    /**
     * Block a user
     */
    async block(userId: string, reason: string, blockedBy?: string): Promise<any> {
        try {
            return await userRepository.updateProfile(userId, {
                is_blocked: true,
                blocked_reason: reason,
                blocked_at: new Date().toISOString(),
                blocked_by: blockedBy || null,
                updated_at: new Date().toISOString(),
            } as any);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            this.log.error('Failed to block user', error);
            throw new BadRequestError('Failed to block user');
        }
    }

    /**
     * Unblock a user
     */
    async unblock(userId: string): Promise<any> {
        try {
            return await userRepository.updateProfile(userId, {
                is_blocked: false,
                blocked_reason: null,
                blocked_at: null,
                blocked_by: null,
                updated_at: new Date().toISOString(),
            } as any);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            this.log.error('Failed to unblock user', error);
            throw new BadRequestError('Failed to unblock user');
        }
    }

    /**
     * Soft delete user (deactivate)
     */
    async delete(userId: string): Promise<void> {
        try {
            await userRepository.updateProfile(userId, {
                is_active: false,
                updated_at: new Date().toISOString(),
            } as any);
        } catch (error) {
            if (error instanceof NotFoundError) throw error;
            this.log.error('Failed to delete user', error);
            throw new BadRequestError('Failed to delete user');
        }
    }

    /**
     * Get user statistics
     */
    async getStats(): Promise<UserStats> {
        try {
            return await userRepository.getStats();
        } catch (error) {
            this.log.error('Failed to fetch user stats', error);
            throw new BadRequestError('Failed to fetch user stats');
        }
    }

    /**
     * Get users by role (helper)
     */
    async getByRole(role: UserRole, filters: UserFilters = {}): Promise<UserListResponse> {
        return this.list({ ...filters, role });
    }
}

export const userService = new UserService();

