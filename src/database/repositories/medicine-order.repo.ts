import { BaseRepository } from '../../common/repositories/base.repo.js';

export class MedicineOrderRepository extends BaseRepository<any> {
    constructor() {
        super('medicine_orders');
    }

    async createOrder(orderData: any, items: any[]) {
        const { data: order, error: orderError } = await this.supabase
            .from('medicine_orders')
            .insert(orderData)
            .select()
            .single();

        if (orderError) throw orderError;

        const { error: itemsError } = await this.supabase
            .from('medicine_order_items')
            .insert(items.map(item => ({ ...item, order_id: order.id })));

        if (itemsError) throw itemsError;

        return order;
    }

    async getOrderById(id: string) {
        const { data, error } = await this.getQuery()
            .select('*, medicine_order_items(*), patients(*), pharmacies(*)')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    async getOrderByNumber(orderNumber: string) {
        const { data, error } = await this.getQuery()
            .select('*, medicine_order_items(*), patients(*), pharmacies(*)')
            .eq('order_number', orderNumber)
            .single();

        if (error) return null;
        return data;
    }

    async listOrders(filters: {
        patientId?: string;
        pharmacyId?: string;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        let query = this.getQuery()
            .select('*, medicine_order_items(*)', { count: 'exact' });

        if (filters.patientId) query = query.eq('patient_id', filters.patientId);
        if (filters.pharmacyId) query = query.eq('pharmacy_id', filters.pharmacyId);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(((filters.page || 1) - 1) * (filters.limit || 20), (filters.page || 1) * (filters.limit || 20) - 1);

        if (error) throw error;
        return { data, total: count || 0 };
    }

    async getStats(pharmacyId: string) {
        const { data, error } = await this.supabase
            .from('medicine_orders')
            .select('status, total_amount, platform_commission')
            .eq('pharmacy_id', pharmacyId);

        if (error) throw error;

        const delivered = data.filter(o => o.status === 'delivered');

        return {
            totalOrders: data.length,
            pendingOrders: data.filter(o => o.status === 'pending').length,
            deliveredOrders: delivered.length,
            cancelledOrders: data.filter(o => o.status === 'cancelled').length,
            totalRevenue: delivered.reduce((sum, o) => sum + (o.total_amount || 0), 0),
            platformCommission: delivered.reduce((sum, o) => sum + (o.platform_commission || 0), 0)
        };
    }
}

export const medicineOrderRepository = new MedicineOrderRepository();
