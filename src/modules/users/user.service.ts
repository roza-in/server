import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import type { UserRole } from '../../types/database.types.js';
import type { UserFilters, UserListResponse, UserStats, UserListItem } from './user.types.js';
import type { UpdateUserInput } from './user.validator.js';
import { userRepository } from '../../database/repositories/user.repo.js';

/**
 * User Service — domain module for user management
 * All writes go through userRepository which targets the `users` table.
 */
class UserService {
    private log = logger.child('UserService');

    /**
     * List users with filters and pagination
     */
    async list(filters: UserFilters): Promise<UserListResponse> {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100);

        const result = await userRepository.findMany(filters, page, limit);

        const users: UserListItem[] = result.data.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            avatar_url: u.avatar_url,
            role: u.role,
            is_active: u.is_active,
            is_blocked: u.is_blocked,
            verification_status: u.verification_status,
            created_at: u.created_at,
            last_login_at: u.last_login_at,
        }));

        return {
            users,
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    }

    /**
     * Get user by ID with full details (joins doctors, hospitals, staff)
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
    async update(userId: string, data: UpdateUserInput): Promise<any> {
        const existing = await userRepository.findById(userId);
        if (!existing) throw new NotFoundError('User not found');

        return userRepository.updateProfile(userId, {
            ...data,
            updated_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Block a user
     */
    async block(userId: string, reason: string, _blockedBy?: string): Promise<any> {
        const existing = await userRepository.findById(userId);
        if (!existing) throw new NotFoundError('User not found');

        return userRepository.updateProfile(userId, {
            is_blocked: true,
            blocked_reason: reason,
            updated_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Unblock a user
     */
    async unblock(userId: string): Promise<any> {
        const existing = await userRepository.findById(userId);
        if (!existing) throw new NotFoundError('User not found');

        return userRepository.updateProfile(userId, {
            is_blocked: false,
            blocked_reason: null,
            updated_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Soft delete user (deactivate)
     */
    async delete(userId: string): Promise<void> {
        const existing = await userRepository.findById(userId);
        if (!existing) throw new NotFoundError('User not found');

        await userRepository.updateProfile(userId, {
            is_active: false,
            updated_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Get user statistics
     */
    async getStats(): Promise<UserStats> {
        return userRepository.getStats();
    }

    /**
     * Get users by role (helper)
     */
    async getByRole(role: UserRole, filters: UserFilters = {}): Promise<UserListResponse> {
        return this.list({ ...filters, role });
    }
}

export const userService = new UserService();

