import { BaseRepository } from '../../common/repositories/base.repo.js';

export class SettlementRepository extends BaseRepository<any> {
    constructor() {
        super('settlements');
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, hospitals(*), settlement_line_items(*)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding settlement by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    async createLineItems(items: any[]): Promise<void> {
        const { error } = await this.supabase
            .from('settlement_line_items')
            .insert(items);

        if (error) {
            this.log.error('Error creating settlement line items', error);
            throw error;
        }
    }

    async getStats() {
        const { data, error } = await this.supabase
            .from('settlements')
            .select('*');

        if (error) throw error;

        const pending = (data || []).filter(s => s.status === 'pending');
        const completed = (data || []).filter(s => s.status === 'completed');

        return {
            pending,
            completed
        };
    }

    async getPendingCount(): Promise<number> {
        const { count, error } = await this.supabase
            .from('settlements')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (error) {
            this.log.error('Error getting pending settlements count', error);
            return 0;
        }
        return count || 0;
    }
}

export const settlementRepository = new SettlementRepository();
