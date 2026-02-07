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
