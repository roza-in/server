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
            .select('*, medicine_order_items(*, medicine:medicines(name, generic_name, image_url)), patient:users!medicine_orders_patient_id_fkey(*), hospital:hospitals(*)')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    async getOrderByNumber(orderNumber: string) {
        const { data, error } = await this.getQuery()
            .select('*, medicine_order_items(*, medicine:medicines(name, generic_name, image_url)), patient:users!medicine_orders_patient_id_fkey(*), hospital:hospitals(*)')
            .eq('order_number', orderNumber)
            .single();

        if (error) return null;
        return data;
    }

    async listOrders(filters: {
        patientId?: string;
        hospitalId?: string;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        let query = this.getQuery()
            .select('*, medicine_order_items(*)', { count: 'exact' });

        if (filters.patientId) query = query.eq('patient_id', filters.patientId);
        if (filters.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(((filters.page || 1) - 1) * (filters.limit || 20), (filters.page || 1) * (filters.limit || 20) - 1);

        if (error) throw error;
        return { data, total: count || 0 };
    }

    async getStats(hospitalId?: string) {
        let query = this.supabase
            .from('medicine_orders')
            .select('status, total_amount, platform_commission');

        if (hospitalId) query = query.eq('hospital_id', hospitalId);

        const { data, error } = await query;

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

    // ============================================================================
    // Prescription → Order Flow
    // ============================================================================

    /**
     * Find existing order for a prescription (prevent duplicate orders)
     */
    async findByPrescriptionId(prescriptionId: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*, medicine_order_items(*, medicine:medicines(name, generic_name, image_url))')
            .eq('prescription_id', prescriptionId)
            .not('status', 'eq', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    }

    /**
     * Find orders by idempotency key
     */
    async findByIdempotencyKey(key: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('idempotency_key', key)
            .maybeSingle();

        if (error) return null;
        return data;
    }

    // ============================================================================
    // Delivery Tracking
    // ============================================================================

    /**
     * Get delivery tracking events for an order
     */
    async getDeliveryTracking(orderId: string) {
        const { data, error } = await this.supabase
            .from('delivery_tracking')
            .select('*')
            .eq('order_id', orderId)
            .order('event_time', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Add a delivery tracking event
     */
    async addDeliveryTrackingEvent(event: {
        order_id: string;
        status: string;
        status_message?: string;
        location?: any;
        source?: string;
        external_status?: string;
    }) {
        const { data, error } = await this.supabase
            .from('delivery_tracking')
            .insert({
                ...event,
                source: event.source || 'system',
                event_time: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ============================================================================
    // Medicine Returns
    // ============================================================================

    /**
     * Create a return request
     */
    async createReturn(returnData: {
        order_id: string;
        reason: string;
        reason_details?: string;
        items: any;
        photos?: string[];
        refund_amount: number;
        initiated_by: string;
    }) {
        const { data, error } = await this.supabase
            .from('medicine_returns')
            .insert({
                ...returnData,
                status: 'pending',
                initiated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get returns for an order
     */
    async getReturns(orderId: string) {
        const { data, error } = await this.supabase
            .from('medicine_returns')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
}

export const medicineOrderRepository = new MedicineOrderRepository();
