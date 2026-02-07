import type { AuthUser } from '../../types/request.js';

/**
 * Authorization Actions
 */
export type AuthAction = 'view' | 'create' | 'update' | 'delete' | 'manage';

/**
 * Policy Interface
 */
export interface IPolicy<T> {
    can(user: AuthUser, action: AuthAction, entity?: T): boolean | Promise<boolean>;
}

/**
 * Base Policy Class
 */
export abstract class BasePolicy<T> implements IPolicy<T> {
    /**
     * Main authorization check
     */
    async can(user: AuthUser, action: AuthAction, entity?: T): Promise<boolean> {
        // Admin bypass
        if (user.role === 'admin') return true;

        const methodName = `can${action.charAt(0).toUpperCase() + action.slice(1)}`;

        if (typeof (this as any)[methodName] === 'function') {
            return (this as any)[methodName](user, entity);
        }

        return false;
    }
}
