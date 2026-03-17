import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { UserSession } from '../../types/database.types.js';

/**
 * Session Repository - Handles user authentication sessions
 */
export class SessionRepository extends BaseRepository<UserSession> {
    constructor() {
        super('user_sessions');
    }

    /**
     * Find active session by refresh token
     */
    async findActiveByRefreshToken(token: string): Promise<UserSession | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('refresh_token_hash', token)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error('Error finding active session by token', error);
            return null;
        }

        return data as UserSession;
    }

    /**
     * Detect refresh token reuse — check if a consumed (rotated-out) token is being replayed.
     * If the incoming hash matches a previous_refresh_token_hash, it means the token was already
     * rotated and someone is replaying the old one → revoke the entire session family.
     */
    async detectTokenReuse(tokenHash: string): Promise<UserSession | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('previous_refresh_token_hash', tokenHash)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            return null;
        }

        return data as UserSession;
    }

    /**
     * Revoke all sessions sharing the same token_family (compromise detected)
     */
    async revokeTokenFamily(tokenFamily: string): Promise<void> {
        const { error } = await this.getQuery()
            .update({ is_active: false } as any)
            .eq('token_family', tokenFamily)
            .eq('is_active', true);

        if (error) {
            this.log.error(`Error revoking token family ${tokenFamily}`, error);
        }
    }

    /**
     * Revoke a single session
     */
    async revoke(id: string): Promise<void> {
        await this.update(id, { is_active: false } as any);
    }

    /**
     * Revoke all sessions for a user (e.g., on password change)
     */
    async revokeAllForUser(userId: string): Promise<void> {
        const { error } = await this.getQuery()
            .update({ is_active: false } as any)
            .eq('user_id', userId);

        if (error) {
            this.log.error(`Error revoking all sessions for user ${userId}`, error);
        }
    }
}

export const sessionRepository = new SessionRepository();
