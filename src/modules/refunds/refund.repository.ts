// @ts-nocheck
import { baseRepository } from '../../database/repositories/../infrastructure/database/base.repo.js';
import { NotFoundError } from '../../common/errors/index.js';
import type { Refund } from '../payments/payment.types.js';

/**
 * Refund Repository
 * Handles database operations for refunds
 */
export class RefundRepository extends BaseRepository<Refund> {
    constructor() {
        super('refunds');
    }

    /**
     * Find refund by ID with relations
     */
    async findByIdWithRelations(id: string): Promise<Refund> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
        *,
        patient:users!refunds_patient_id_fkey(*),
        payment:payments(*),
        appointment:appointments(*)
      `)
            .eq('id', id)
            .single();

        if (error) {
            this.log.error(`Error finding refund by id: ${id}`, error);
            throw new NotFoundError(MESSAGES.NOT_FOUND);
        }

        return data;
    }

    /**
     * Find existing refund for a payment
     */
    async findByPaymentId(paymentId: string): Promise<Refund | null> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('payment_id', paymentId)
            .in('status', ['pending', 'processing', 'completed'])
            .maybeSingle();

        if (error) {
            this.log.error(`Error finding refund for payment: ${paymentId}`, error);
            return null;
        }

        return data;
    }

    /**
     * Find refund by Razorpay Refund ID
     */
    async findByRazorpayRefundId(refundId: string): Promise<Refund | null> {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('id, status, payment_id')
            .eq('razorpay_refund_id', refundId)
            .single();

        if (error && error.code !== 'PGRST116') {
            this.log.error(`Error finding refund by razorpay id: ${refundId}`, error);
            return null;
        }

        return data as Refund;
    }

    /**
     * List refunds with filtering
     */
    async findMany(filters: {
        payment_id?: string;
        patient_id?: string;
        appointment_id?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ data: Refund[]; total: number }> {
        let query = this.supabase
            .from(this.tableName)
            .select(`
        *,
        patient:users!refunds_patient_id_fkey(id, name, phone),
        payment:payments(id, amount, razorpay_payment_id)
      `, { count: 'exact' });

        if (filters.payment_id) query = query.eq('payment_id', filters.payment_id);
        if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);
        if (filters.appointment_id) query = query.eq('appointment_id', filters.appointment_id);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.date_from) query = query.gte('created_at', filters.date_from);
        if (filters.date_to) query = query.lte('created_at', filters.date_to);

        query = query.order('created_at', { ascending: false });

        if (filters.limit && filters.offset !== undefined) {
            query = query.range(filters.offset, filters.offset + filters.limit - 1);
        }

        const { data, count, error } = await query;

        if (error) {
            this.log.error('Error listing refunds', error);
            throw error;
        }

        return {
            data: data as any[],
            total: count || 0,
        };
    }

    /**
     * Get refund stats
     */
    async getStats(): Promise<{ pending: Refund[]; completed: Refund[]; totalCount: number }> {
        const { data, count, error } = await this.supabase
            .from(this.tableName)
            .select('refund_amount, status', { count: 'exact' });

        if (error) {
            this.log.error('Error getting refund stats', error);
            throw error;
        }

        const pending = (data || []).filter((r: any) => r.status === 'pending');
        const completed = (data || []).filter((r: any) => r.status === 'completed');

        return {
            pending,
            completed,
            totalCount: count || 0,
        };
    }
}

export const refundRepository = new RefundRepository();


