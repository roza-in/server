import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Settlement, SettlementLineItem } from '../../types/database.types.js';

export class SettlementRepository extends BaseRepository<Settlement> {
    constructor() {
        super('settlements');
    }

    /**
     * Find settlement by ID with line items + approved_by user + entity
     */
    async findByIdWithRelations(id: string) {
        const { data, error } = await this.getQuery()
            .select('*, settlement_line_items(*), approved_by_user:users!settlements_approved_by_fkey(id, name, email)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding settlement by ID: ${id}`, error);
            return null;
        }

        // Resolve entity (hospital/pharmacy) based on entity_type/entity_id
        if (data) {
            const table = data.entity_type === 'hospital' ? 'hospitals' : 'pharmacies';
            if (data.entity_id) {
                const { data: entity } = await this.supabase
                    .from(table)
                    .select('id, name, slug, city, state')
                    .eq('id', data.entity_id)
                    .single();
                (data as any).entity = entity;
            }
        }

        return data;
    }

    /**
     * Bulk-insert settlement line items
     */
    async createLineItems(items: Omit<SettlementLineItem, 'id' | 'created_at'>[]): Promise<void> {
        const { error } = await this.supabase
            .from('settlement_line_items')
            .insert(items as any);

        if (error) {
            this.log.error('Error creating settlement line items', error);
            throw error;
        }
    }

    /**
     * Aggregate stats using COUNT+SUM — never fetches all rows.
     */
    async getStats(filters?: { entityType?: string; entityId?: string }) {
        const statuses = ['pending', 'processing', 'completed'] as const;
        const result: Record<string, { count: number; amount: number }> = {};

        for (const status of statuses) {
            let query = this.supabase
                .from('settlements')
                .select('net_payable', { count: 'exact', head: false })
                .eq('status', status);

            if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
            if (filters?.entityId) query = query.eq('entity_id', filters.entityId);

            const { data, count, error } = await query;
            if (error) throw error;

            const amount = (data || []).reduce((s, r: any) => s + Number(r.net_payable || 0), 0);
            result[status] = { count: count || 0, amount };
        }

        return result;
    }

    /**
     * Count pending settlements
     */
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

    /**
     * Find settlements for a specific entity (hospital/pharmacy) — paginated
     */
    async findByEntity(entityType: string, entityId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.supabase
            .from('settlements')
            .select('*', { count: 'exact' })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * List settlements with optional filters — paginated
     */
    async listSettlements(filters: {
        entityType?: string;
        entityId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('settlements')
            .select('*', { count: 'exact' });

        if (filters.entityType) query = query.eq('entity_type', filters.entityType);
        if (filters.entityId) query = query.eq('entity_id', filters.entityId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.startDate) query = query.gte('period_start', filters.startDate);
        if (filters.endDate) query = query.lte('period_end', filters.endDate);

        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Find settlements within a date range
     */
    async findByDateRange(startDate: string, endDate: string) {
        const { data, error } = await this.supabase
            .from('settlements')
            .select('*')
            .gte('period_start', startDate)
            .lte('period_end', endDate)
            .order('period_start', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Check for overlapping settlement for the same entity + period
     */
    async findOverlapping(entityType: string, entityId: string, periodStart: string, periodEnd: string) {
        const { data, error } = await this.supabase
            .from('settlements')
            .select('id, settlement_number, period_start, period_end, status')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .lte('period_start', periodEnd)
            .gte('period_end', periodStart)
            .not('status', 'in', '("cancelled","failed")')
            .limit(1);

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }
}

export const settlementRepository = new SettlementRepository();
