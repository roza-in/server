import { BasePolicy } from '../../common/authorization/types.js';
import { AuthUser } from '../../types/request.js';
import { UserProfile } from '../users/user.types.js';

/**
 * User Policy - Governs access to user profiles and account actions
 */
export class UserPolicy extends BasePolicy<UserProfile> {
    /**
     * Check if user is a platform admin
     */
    isAdmin(user: AuthUser): boolean {
        return user.role === 'admin';
    }

    /**
     * Can view a user profile
     * - Users can view their own profile
     * - Admins can view any profile
     */
    canView(user: AuthUser, targetUser: UserProfile | { id: string }): boolean {
        if (this.isAdmin(user)) return true;
        return user.userId === targetUser.id;
    }

    /**
     * Can update a user profile
     * - Users can update their own profile
     * - Admins can update any profile
     */
    canUpdate(user: AuthUser, targetUser: UserProfile | { id: string }): boolean {
        if (this.isAdmin(user)) return true;
        return user.userId === targetUser.id;
    }

    /**
     * Can delete/deactivate a user
     * - ONLY Admins can delete or deactivate users
     */
    canDelete(user: AuthUser): boolean {
        return this.isAdmin(user);
    }

    /**
     * Can manage user roles
     * - ONLY Admins can change user roles
     */
    canManageRoles(user: AuthUser): boolean {
        return this.isAdmin(user);
    }
}

export const userPolicy = new UserPolicy();

