import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Notification } from '../../types/database.types.js';

export class NotificationRepository extends BaseRepository<Notification> {
    constructor() {
        super('notifications');
    }

    async findUnreadByUserId(userId: string): Promise<Notification[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('user_id', userId)
            .is('read_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Notification[];
    }

    async markAsRead(id: string): Promise<void> {
        await this.update(id, { read_at: new Date().toISOString(), status: 'read' } as any);
    }

    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await this.getQuery()
            .update({ read_at: new Date().toISOString(), status: 'read' } as any)
            .eq('user_id', userId)
            .is('read_at', null);

        if (error) throw error;
    }

    async findByUserId(userId: string, page = 1, limit = 20): Promise<{ data: Notification[]; total: number }> {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data as Notification[], total: count || 0 };
    }

    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await this.getQuery()
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('read_at', null);

        if (error) {
            this.log.error(`Error getting unread count for user ${userId}`, error);
            return 0;
        }
        return count || 0;
    }
}

export const notificationRepository = new NotificationRepository();
