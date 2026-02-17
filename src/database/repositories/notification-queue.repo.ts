import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface NotificationQueueRow {
    id: string;
    notification_id: string | null;
    channel: string;
    recipient: string;
    payload: any;
    status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
    attempts: number;
    max_attempts: number;
    next_attempt_at: string | null;
    last_error: string | null;
    priority: number;
    scheduled_for: string;
    processed_at: string | null;
    created_at: string;
}

/**
 * Notification Queue Repository - Outbound notification delivery queue
 */
export class NotificationQueueRepository extends BaseRepository<NotificationQueueRow> {
    constructor() {
        super('notification_queue');
    }

    /**
     * Get pending notifications ready for processing
     */
    async findPending(limit = 50): Promise<NotificationQueueRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString())
            .order('priority', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get failed notifications eligible for retry
     */
    async findRetryable(limit = 50): Promise<NotificationQueueRow[]> {
        const now = new Date().toISOString();
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('status', 'failed')
            .lte('next_attempt_at', now)
            .order('priority', { ascending: true })
            .limit(limit);

        if (error) throw error;
        // Filter: attempts < max_attempts (can't do this in Supabase filter directly with column comparison)
        return (data || []).filter(n => n.attempts < n.max_attempts);
    }

    /**
     * Mark as processing (claim for a worker)
     */
    async markProcessing(id: string) {
        return this.update(id, {
            status: 'processing',
        } as any);
    }

    /**
     * Mark as sent
     */
    async markSent(id: string) {
        return this.update(id, {
            status: 'sent',
            processed_at: new Date().toISOString(),
        } as any);
    }

    /**
     * Mark as failed with error and schedule retry
     */
    async markFailed(id: string, error: string, retryAfterMs = 60000) {
        const current = await this.findById(id);
        if (!current) return null;

        const nextAttempt = new Date(Date.now() + retryAfterMs * Math.pow(2, current.attempts));

        const { data, error: updateError } = await this.supabase
            .from('notification_queue')
            .update({
                status: 'failed',
                last_error: error,
                attempts: current.attempts + 1,
                next_attempt_at: nextAttempt.toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;
        return data;
    }

    /**
     * Enqueue a notification for delivery
     */
    async enqueue(entry: {
        notification_id?: string;
        channel: string;
        recipient: string;
        payload: any;
        priority?: number;
        scheduled_for?: string;
    }) {
        return this.create({
            notification_id: entry.notification_id,
            channel: entry.channel,
            recipient: entry.recipient,
            payload: entry.payload,
            priority: entry.priority || 5,
            scheduled_for: entry.scheduled_for || new Date().toISOString(),
            status: 'pending',
            attempts: 0,
            max_attempts: 3,
        } as any);
    }

    /**
     * Get queue stats
     */
    async getStats() {
        const { data, error } = await this.supabase
            .from('notification_queue')
            .select('status', { count: 'exact' });

        if (error) throw error;

        const items = data || [];
        return {
            pending: items.filter(i => i.status === 'pending').length,
            processing: items.filter(i => i.status === 'processing').length,
            sent: items.filter(i => i.status === 'sent').length,
            failed: items.filter(i => i.status === 'failed').length,
            total: items.length,
        };
    }
}

export const notificationQueueRepository = new NotificationQueueRepository();
