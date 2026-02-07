import { ForbiddenError } from '../errors/index.js';
import type { AuthUser } from '../../types/request.js';
import type { AuthAction, IPolicy } from './types.js';

/**
 * Policy Service - Centralized authorization evaluator
 */
export class PolicyService {
    private policies: Map<string, IPolicy<any>> = new Map();

    /**
     * Register a policy for a specific entity type
     */
    register(entityType: string, policy: IPolicy<any>): void {
        this.policies.set(entityType.toLowerCase(), policy);
    }

    /**
     * Authorize an action on an entity
     * Throws ForbiddenError if not authorized
     */
    async authorize<T>(
        user: AuthUser,
        action: AuthAction,
        entityType: string,
        entity?: T
    ): Promise<void> {
        const policy = this.policies.get(entityType.toLowerCase());

        if (!policy) {
            throw new Error(`No policy registered for entity type: ${entityType}`);
        }

        const isAuthorized = await policy.can(user, action, entity);

        if (!isAuthorized) {
            throw new ForbiddenError(`You are not authorized to ${action} this ${entityType}`);
        }
    }

    /**
     * Check if an action is authorized (returns boolean)
     */
    async can<T>(
        user: AuthUser,
        action: AuthAction,
        entityType: string,
        entity?: T
    ): Promise<boolean> {
        const policy = this.policies.get(entityType.toLowerCase());
        if (!policy) return false;
        return policy.can(user, action, entity);
    }
}

export const policyService = new PolicyService();
