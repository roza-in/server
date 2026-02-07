import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Refund } from '../../modules/payments/payment.types.js';

export class RefundRepository extends BaseRepository<Refund> {
    constructor() {
        super('refunds');
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, payments(*), appointments(*)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding refund by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    async findByGatewayRefundId(gatewayRefundId: string): Promise<(Refund & { payment_id: string }) | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('gateway_refund_id', gatewayRefundId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding refund by Gateway ID: ${gatewayRefundId}`, error);
            return null;
        }
        return data as (Refund & { payment_id: string }) | null;
    }

    async getStats() {
        const { data, error } = await this.supabase
            .from('refunds')
            .select('*');

        if (error) throw error;

        const pending = (data || []).filter(r => r.status === 'pending');
        const completed = (data || []).filter(r => r.status === 'completed');

        return {
            pending,
            completed,
            totalCount: data?.length || 0
        };
    }
}

export const refundRepository = new RefundRepository();
