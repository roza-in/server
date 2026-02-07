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
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Notification[];
    }

    async markAsRead(id: string): Promise<void> {
        await this.update(id, { is_read: true } as any);
    }

    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await this.getQuery()
            .update({ is_read: true } as any)
            .eq('user_id', userId);

        if (error) throw error;
    }
}

export const notificationRepository = new NotificationRepository();
