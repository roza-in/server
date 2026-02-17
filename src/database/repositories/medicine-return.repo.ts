/**
 * Medicine Return Repository
 * Data access for medicine_returns table
 */

import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { MedicineReturn } from '../../types/database.types.js';

export class MedicineReturnRepository extends BaseRepository<MedicineReturn> {
    constructor() {
        super('medicine_returns');
    }

    /**
     * Find return with order & patient details
     */
    async findByIdWithRelations(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, order:medicine_orders(*, patient:users!medicine_orders_patient_id_fkey(id, name, phone, email))')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding medicine return by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    /**
     * Find return by return number
     */
    async findByReturnNumber(returnNumber: string): Promise<MedicineReturn | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('return_number', returnNumber)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding return by number: ${returnNumber}`, error);
            return null;
        }
        return data as MedicineReturn;
    }

    /**
     * Find returns for an order
     */
    async findByOrderId(orderId: string): Promise<MedicineReturn[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false });

        if (error) {
            this.log.error(`Error finding returns for order: ${orderId}`, error);
            return [];
        }
        return (data || []) as MedicineReturn[];
    }

    /**
     * List returns with filters
     */
    async listReturns(filters: {
        orderId?: string;
        status?: string;
        patientId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = this.getQuery()
            .select('*, order:medicine_orders(order_number, patient_id, status, total_amount)', { count: 'exact' });

        if (filters.orderId) query = query.eq('order_id', filters.orderId);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);

        // Filter by patient through order
        if (filters.patientId) {
            query = query.eq('order.patient_id', filters.patientId);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    /**
     * Get return statistics
     */
    async getStats(hospitalId?: string) {
        let query = this.supabase
            .from('medicine_returns')
            .select('status, refund_amount');

        // If hospital scoped, join through orders
        if (hospitalId) {
            query = this.supabase
                .from('medicine_returns')
                .select('status, refund_amount, order:medicine_orders!inner(hospital_id)')
                .eq('order.hospital_id', hospitalId) as any;
        }

        const { data, error } = await query;
        if (error) throw error;

        const returns = data || [];
        return {
            totalReturns: returns.length,
            pendingReturns: returns.filter((r: any) => r.status === 'pending').length,
            approvedReturns: returns.filter((r: any) => r.status === 'approved').length,
            rejectedReturns: returns.filter((r: any) => r.status === 'rejected').length,
            totalRefundAmount: returns
                .filter((r: any) => r.status === 'approved' || r.status === 'completed')
                .reduce((sum: number, r: any) => sum + (r.refund_amount || 0), 0),
        };
    }
}

export const medicineReturnRepository = new MedicineReturnRepository();
