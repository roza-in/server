import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Payment } from '../../modules/payments/payment.types.js';

export class PaymentRepository extends BaseRepository<Payment> {
    constructor() {
        super('payments');
    }

    async findByGatewayOrderId(orderId: string): Promise<Payment | null> {
        return this.findOne({ gateway_order_id: orderId } as any);
    }

    async findByGatewayPaymentId(paymentId: string): Promise<Payment | null> {
        return this.findOne({ gateway_payment_id: paymentId } as any);
    }

    async findPendingByAppointmentId(appointmentId: string): Promise<Payment | null> {
        return this.findOne({ appointment_id: appointmentId, status: 'pending' } as any);
    }

    async findByIdWithRelations(id: string) {
        const { data, error } = await this.getQuery()
            .select(`
                *,
                payer:payer_user_id(*),
                hospital:hospital_id(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    override async findMany(filters: {
        patient_id?: string;
        doctor_id?: string;
        hospital_id?: string;
        status?: string | string[];
        limit?: number;
        offset?: number;
    }): Promise<{ data: Payment[]; total: number }> {
        let query = this.getQuery()
            .select(`
                *,
                payer:payer_user_id(id, name, phone, email),
                hospital:hospital_id(id, name)
            `, { count: 'exact' });

        if (filters.patient_id) query = query.eq('payer_user_id', filters.patient_id);
        if (filters.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }

        query = query.order('created_at', { ascending: false });

        if (filters.limit) query = query.limit(filters.limit);
        if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);

        const { data, error, count } = await query;

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    async getStats(filters: {
        hospital_id?: string;
        doctor_id?: string;
        date_from?: string;
        date_to?: string;
    }): Promise<{ completed: Payment[]; refunded: Payment[] }> {
        let query = this.getQuery().select('*');

        if (filters.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
        if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id);
        if (filters.date_from) query = query.gte('created_at', filters.date_from);
        if (filters.date_to) query = query.lte('created_at', filters.date_to);

        const { data, error } = await query;

        if (error) throw error;

        const payments = data || [];
        return {
            completed: payments.filter((p: Payment) => p.status === 'completed'),
            refunded: payments.filter((p: Payment) => p.status === 'refunded'),
        };
    }
}

export const paymentRepository = new PaymentRepository();
