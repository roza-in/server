/**
 * Pharmacy Settlement Repository
 * Data access for pharmacy_settlements table
 */

import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { PharmacySettlement } from '../../types/database.types.js';

export class PharmacySettlementRepository extends BaseRepository<PharmacySettlement> {
    constructor() {
        super('pharmacy_settlements');
    }

    /**
     * Find settlement with hospital details
     */
    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, hospital:hospitals(id, name, slug, city, state)')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding pharmacy settlement by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    /**
     * Find settlement by settlement number
     */
    async findBySettlementNumber(settlementNumber: string): Promise<PharmacySettlement | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('settlement_number', settlementNumber)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding settlement by number: ${settlementNumber}`, error);
            return null;
        }
        return data as PharmacySettlement;
    }

    /**
     * List settlements for a hospital
     */
    async findByHospitalId(hospitalId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * List settlements with filters
     */
    async listSettlements(filters: {
        hospitalId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = this.getQuery()
            .select('*, hospital:hospitals(id, name, slug)', { count: 'exact' });

        if (filters.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.startDate) query = query.gte('period_start', filters.startDate);
        if (filters.endDate) query = query.lte('period_end', filters.endDate);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Find settlements by date range
     */
    async findByDateRange(hospitalId: string, startDate: string, endDate: string) {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('hospital_id', hospitalId)
            .gte('period_start', startDate)
            .lte('period_end', endDate)
            .order('period_start', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Get statistics
     */
    async getStats(hospitalId?: string) {
        let query = this.supabase
            .from('pharmacy_settlements')
            .select('status, net_payable, gross_commission, tds_amount');

        if (hospitalId) query = query.eq('hospital_id', hospitalId);

        const { data, error } = await query;
        if (error) throw error;

        const settlements = data || [];
        const completed = settlements.filter(s => s.status === 'completed');

        return {
            totalSettlements: settlements.length,
            pendingSettlements: settlements.filter(s => s.status === 'pending').length,
            processingSettlements: settlements.filter(s => s.status === 'processing').length,
            completedSettlements: completed.length,
            totalPayable: completed.reduce((sum, s) => sum + (s.net_payable || 0), 0),
            totalCommission: completed.reduce((sum, s) => sum + (s.gross_commission || 0), 0),
            totalTds: completed.reduce((sum, s) => sum + (s.tds_amount || 0), 0),
        };
    }

    /**
     * Get pending count
     */
    async getPendingCount(hospitalId?: string): Promise<number> {
        let query = this.supabase
            .from('pharmacy_settlements')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (hospitalId) query = query.eq('hospital_id', hospitalId);

        const { count, error } = await query;
        if (error) {
            this.log.error('Error getting pending pharmacy settlements count', error);
            return 0;
        }
        return count || 0;
    }
}

export const pharmacySettlementRepository = new PharmacySettlementRepository();
