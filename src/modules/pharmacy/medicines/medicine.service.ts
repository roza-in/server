/**
 * Medicine Service
 * Business logic for medicine e-commerce
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import { logger } from '../../../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../common/errors/index.js';
import { medicineRepository } from '../../../database/repositories/medicine.repo.js';
import { medicineOrderRepository } from '../../../database/repositories/medicine-order.repo.js';
import { prescriptionRepository } from '../../../database/repositories/prescription.repo.js';
import { platformConfigService } from '../../platform-config/platform-config.service.js';
import type {
    Medicine,
    MedicineOrder,
    MedicineOrderStatus,
    PaymentStatus,
} from '../../../types/database.types.js';
import type {
    MedicineSearchFilters,
    CreateMedicineOrderInput,
    OrderPricingBreakdown,
    MedicineOrderWithDetails,
    PrescriptionToOrderMapping,
    MedicineOrderStats,
} from './medicine.types.js';

const log = logger.child('MedicineService');

// DELIVERY_BASE_FEE and MEDICINE_COMMISSION_PERCENT now managed by PlatformConfigService

class MedicineService {
    // ============================================================================
    // Medicine Search
    // ============================================================================

    async searchMedicines(filters: MedicineSearchFilters) {
        const { medicines, total } = await medicineRepository.search({
            query: filters.query,
            category: filters.category,
            schedule: filters.schedule,
            brand: filters.brand,
            priceMin: filters.priceMin,
            priceMax: filters.priceMax,
            page: filters.page || 1,
            limit: filters.limit || 20,
        });

        return {
            medicines,
            total,
            page: filters.page || 1,
            limit: filters.limit || 20,
            hasMore: (filters.page || 1) * (filters.limit || 20) < total,
        };
    }

    async getMedicineById(id: string): Promise<Medicine> {
        const medicine = await medicineRepository.findById(id);
        if (!medicine) {
            throw new NotFoundError('Medicine not found');
        }
        return medicine as Medicine;
    }

    // ============================================================================
    // Inventory Management
    // ============================================================================

    async checkStockAvailability(items: { medicineId: string; quantity: number }[]): Promise<void> {
        const medicineIds = items.map(i => i.medicineId);
        const medicines = await medicineRepository.findByIds(medicineIds);

        for (const item of items) {
            const medicine = medicines.find(m => m.id === item.medicineId);
            if (!medicine) {
                throw new BadRequestError(`Medicine not found: ${item.medicineId}`);
            }

            if (!medicine.is_active) {
                throw new BadRequestError(`Medicine is not active: ${medicine.name}`);
            }

            if (!medicine.is_in_stock || medicine.stock_quantity < item.quantity) {
                throw new BadRequestError(`Insufficient stock for: ${medicine.name}. Available: ${medicine.stock_quantity}`);
            }
        }
    }

    async updateStock(medicineId: string, quantityChange: number): Promise<void> {
        const medicine = await medicineRepository.findById(medicineId);
        if (!medicine) return;

        const newQuantity = medicine.stock_quantity + quantityChange;
        const isInStock = newQuantity > 0;

        await medicineRepository.update(medicineId, {
            stock_quantity: newQuantity,
            is_in_stock: isInStock,
        } as any);
    }

    // ============================================================================
    // Order Creation
    // ============================================================================

    async createOrder(
        patientId: string,
        input: CreateMedicineOrderInput,
    ): Promise<MedicineOrderWithDetails> {
        log.info('Creating medicine order', { patientId });

        // Validate idempotency
        if (input.idempotencyKey) {
            const existing = await this.getOrderByIdempotencyKey(input.idempotencyKey);
            if (existing) {
                log.info('Returning existing order for idempotency key', { orderId: existing.id });
                return existing;
            }
        }

        // Delivery address is required
        if (!input.deliveryAddress) {
            throw new BadRequestError('Delivery address is required');
        }

        // Get medicine details
        const medicineIds = input.items.map(item => item.medicineId);
        const medicines = await medicineRepository.findByIds(medicineIds);

        if (medicines.length !== medicineIds.length) {
            throw new BadRequestError('Some medicines not found');
        }

        // Check prescription requirements
        const requiresPrescription = medicines.some(m => m.is_prescription_required);
        if (requiresPrescription && !input.prescriptionId) {
            throw new BadRequestError('Prescription is required for some medicines');
        }

        // Check stock availability
        await this.checkStockAvailability(input.items);

        // Calculate pricing
        const pricing = await this.calculateOrderPricing(medicines, input.items, input.hospitalId);

        // Create order — fields aligned to migration 007 medicine_orders table
        const orderData = {
            patient_id: patientId,
            family_member_id: input.familyMemberId || null,
            prescription_id: input.prescriptionId || null,
            delivery_address: input.deliveryAddress,
            items_total: pricing.subtotal,
            discount_amount: pricing.discountAmount,
            delivery_fee: pricing.deliveryFee,
            gst_amount: pricing.gstAmount,
            total_amount: pricing.totalAmount,
            hospital_commission: pricing.hospitalCommission,
            platform_commission: pricing.platformCommission,
            status: 'pending' as MedicineOrderStatus,
            payment_status: 'pending' as PaymentStatus,
            requires_prescription: requiresPrescription,
            prescription_verified: false,
            idempotency_key: input.idempotencyKey || null,
            placed_at: new Date().toISOString(),
        };

        const orderItems = input.items.map((item, index) => {
            const medicine = medicines.find(m => m.id === item.medicineId)!;
            return {
                medicine_id: item.medicineId,
                prescription_item_index: item.prescriptionItemIndex ?? null,
                quantity: item.quantity,
                unit_mrp: medicine.mrp,
                unit_selling_price: medicine.selling_price ?? medicine.mrp,
                discount_percent: medicine.discount_percent ?? 0,
                subtotal: (medicine.selling_price ?? medicine.mrp) * item.quantity,
                medicine_name: medicine.name,
                medicine_brand: medicine.brand || null,
                medicine_strength: medicine.strength || null,
                medicine_pack_size: medicine.pack_size || null,
                requires_prescription: medicine.is_prescription_required ?? false,
                is_substitute: false,
                original_medicine_id: null,
                substitution_approved: false,
            };
        });

        const order = await medicineOrderRepository.createOrder(orderData as any, orderItems);

        // Link prescription back to order
        if (input.prescriptionId) {
            await prescriptionRepository.markMedicineOrdered(input.prescriptionId, order.id).catch(err => {
                log.warn('Failed to mark prescription as ordered', { prescriptionId: input.prescriptionId, error: err.message });
            });
        }

        // Deduct stock for each item
        for (const item of input.items) {
            await this.updateStock(item.medicineId, -item.quantity);
        }

        log.info('Medicine order created', { orderId: order.id, orderNumber: order.order_number });

        return order as MedicineOrderWithDetails;
    }

    async calculateOrderPricing(
        medicines: Medicine[],
        items: { medicineId: string; quantity: number }[],
        hospitalId?: string
    ): Promise<OrderPricingBreakdown> {
        // Calculate subtotal and commissions from medicine details
        let subtotal = 0;
        let totalGst = 0;
        let totalHospitalCommission = 0;

        const [globalMedicineCommRate] = await Promise.all([
            platformConfigService.getMedicineCommissionRate(hospitalId),
        ]);

        for (const item of items) {
            const medicine = medicines.find(m => m.id === item.medicineId);
            if (medicine) {
                const unitPrice = medicine.selling_price ?? medicine.mrp;
                const itemSubtotal = unitPrice * item.quantity;
                subtotal += itemSubtotal;

                // GST on medicine (using its HSN/GST config)
                const gstRate = Number(medicine.gst_percent || 12);
                totalGst += Math.round((itemSubtotal * gstRate) / 100);

                // Commission for referring hospital
                const commRate = medicine.hospital_commission_percent !== null
                    ? Number(medicine.hospital_commission_percent)
                    : globalMedicineCommRate;
                totalHospitalCommission += Math.round((itemSubtotal * commRate) / 100);
            }
        }

        // Delivery fee
        const deliveryFee = await platformConfigService.getDeliveryFee();
        const discountAmount = 0;

        // Platform commission = subtotal - hospital commission
        const commissionRate = await platformConfigService.getMedicineCommissionRate(hospitalId);
        const hospitalCommission = Math.round((subtotal * (commissionRate / 100)) * 100) / 100;
        const platformCommission = Math.round((subtotal - hospitalCommission) * 100) / 100;

        // Total = subtotal + gst + delivery - discount
        const totalAmount = subtotal + totalGst + deliveryFee - discountAmount;

        return {
            subtotal,
            discountAmount,
            deliveryFee,
            gstAmount: totalGst,
            totalAmount,
            hospitalCommission: totalHospitalCommission,
            platformCommission,
        };
    }

    // ============================================================================
    // Order Management
    // ============================================================================

    async getOrderById(orderId: string, userId?: string): Promise<MedicineOrderWithDetails> {
        const order = await medicineOrderRepository.getOrderById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Check access — patient can view own orders
        if (userId && order.patient_id !== userId) {
            throw new ForbiddenError('Access denied');
        }

        return order as MedicineOrderWithDetails;
    }

    async getOrderByNumber(orderNumber: string): Promise<MedicineOrderWithDetails> {
        const order = await medicineOrderRepository.getOrderByNumber(orderNumber);
        if (!order) {
            throw new NotFoundError('Order not found');
        }
        return order as MedicineOrderWithDetails;
    }

    async getOrderByIdempotencyKey(key: string): Promise<MedicineOrderWithDetails | null> {
        const order = await medicineOrderRepository.findByIdempotencyKey(key);
        return order as MedicineOrderWithDetails | null;
    }

    async listPatientOrders(patientId: string, filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        const { data, total } = await medicineOrderRepository.listOrders({
            patientId,
            status: filters.status,
            page: filters.page || 1,
            limit: filters.limit || 20,
        });

        return { orders: data, total };
    }

    async listHospitalOrders(hospitalId: string, filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        const { data, total } = await medicineOrderRepository.listOrders({
            hospitalId,
            status: filters.status,
            page: filters.page || 1,
            limit: filters.limit || 20,
        });

        return { orders: data, total };
    }

    // ============================================================================
    // Order Status Updates
    // ============================================================================

    async confirmOrder(
        userId: string,
        orderId: string,
        estimatedReadyTime?: string,
        notes?: string,
    ): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'pending') {
            throw new BadRequestError(`Cannot confirm order in ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, {
            status: 'confirmed',
            internal_notes: notes || null,
            estimated_delivery_at: estimatedReadyTime || null,
            confirmed_at: new Date().toISOString(),
        } as any);

        return this.getOrderById(orderId);
    }

    async markAsProcessing(userId: string, orderId: string): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'confirmed') {
            throw new BadRequestError(`Cannot mark as processing from ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, { status: 'processing' } as any);
        return this.getOrderById(orderId);
    }

    async markAsReady(userId: string, orderId: string): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'processing') {
            throw new BadRequestError(`Cannot mark as ready from ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, {
            status: 'ready_for_pickup',
            packed_at: new Date().toISOString(),
        } as any);
        return this.getOrderById(orderId);
    }

    async dispatchOrder(
        userId: string,
        orderId: string,
        deliveryPartner?: string,
        trackingId?: string,
    ): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'ready_for_pickup' && order.status !== 'processing') {
            throw new BadRequestError(`Cannot dispatch from ${order.status} status`);
        }

        // Generate delivery OTP
        const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

        await medicineOrderRepository.update(orderId, {
            status: 'dispatched',
            delivery_partner: deliveryPartner || null,
            delivery_tracking_id: trackingId || null,
            delivery_otp: deliveryOtp,
            dispatched_at: new Date().toISOString(),
        } as any);

        // Record delivery tracking event
        await medicineOrderRepository.addDeliveryTrackingEvent({
            order_id: orderId,
            status: 'dispatched',
            status_message: 'Order dispatched for delivery',
            source: 'system',
        }).catch(err => log.warn('Failed to add dispatch tracking event', { orderId, error: err.message }));

        return this.getOrderById(orderId);
    }

    async completeDelivery(orderId: string, otp: string): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'dispatched' && order.status !== 'out_for_delivery') {
            throw new BadRequestError(`Cannot complete from ${order.status} status`);
        }

        // Verify delivery OTP
        if (order.delivery_otp && order.delivery_otp !== otp) {
            throw new BadRequestError('Invalid delivery OTP');
        }

        await medicineOrderRepository.update(orderId, {
            status: 'delivered',
            delivered_at: new Date().toISOString(),
        } as any);

        // Record delivery tracking event
        await medicineOrderRepository.addDeliveryTrackingEvent({
            order_id: orderId,
            status: 'delivered',
            status_message: 'Order delivered successfully',
            source: 'system',
        }).catch(err => log.warn('Failed to add delivery tracking event', { orderId, error: err.message }));

        return this.getOrderById(orderId);
    }

    async cancelOrder(
        userId: string,
        orderId: string,
        reason: string,
    ): Promise<MedicineOrderWithDetails> {
        const order = await this.getOrderById(orderId);

        // Can only cancel pending or confirmed orders
        const canCancel = ['pending', 'confirmed'].includes(order.status);
        if (!canCancel) {
            throw new BadRequestError(`Cannot cancel order in ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, {
            status: 'cancelled',
            cancellation_reason: reason,
            cancelled_by: userId,
            cancelled_at: new Date().toISOString(),
        } as any);

        // Restore stock for cancelled orders
        const orderItems = order.medicine_order_items || [];
        for (const item of orderItems) {
            await this.updateStock(item.medicine_id, item.quantity);
        }

        return this.getOrderById(orderId);
    }

    // ============================================================================
    // Delivery Tracking & Returns
    // ============================================================================

    async getDeliveryTracking(orderId: string, userId?: string) {
        await this.getOrderById(orderId, userId);
        return medicineOrderRepository.getDeliveryTracking(orderId);
    }

    async createReturn(
        userId: string,
        orderId: string,
        returnData: { reason: string; reason_details?: string; items?: any[]; photos?: string[]; refund_amount?: number },
    ) {
        const order = await this.getOrderById(orderId, userId);

        if (order.status !== 'delivered') {
            throw new BadRequestError('Can only return delivered orders');
        }

        return medicineOrderRepository.createReturn({
            order_id: orderId,
            reason: returnData.reason,
            reason_details: returnData.reason_details,
            items: returnData.items || [],
            photos: returnData.photos,
            refund_amount: returnData.refund_amount || 0,
            initiated_by: userId,
        });
    }

    async getReturns(orderId: string, userId?: string) {
        await this.getOrderById(orderId, userId);
        return medicineOrderRepository.getReturns(orderId);
    }

    async getUnorderedPrescriptions(patientId: string) {
        return prescriptionRepository.findUnorderedByPatient(patientId);
    }

    // ============================================================================
    // Prescription Mapping
    // ============================================================================

    async mapPrescriptionToMedicines(prescriptionId: string): Promise<PrescriptionToOrderMapping> {
        // 1. Get prescription
        const prescription = await prescriptionRepository.findById(prescriptionId);
        if (!prescription) {
            throw new NotFoundError('Prescription not found');
        }

        // 2. Check if already ordered
        const existingOrder = await medicineOrderRepository.findByPrescriptionId(prescriptionId);
        if (existingOrder) {
            log.info('Prescription already has an active order', { prescriptionId, orderId: existingOrder.id });
        }

        // 3. Parse medications JSONB array
        const medications: any[] = (prescription as any).medications || [];
        if (!medications.length) {
            throw new BadRequestError('Prescription has no medications');
        }

        // 4. Match each medication to medicines catalog
        const mappedMedicines = await Promise.all(
            medications.map(async (med: any) => {
                const medName = med.name || med.medicine_name || '';
                const genericName = med.generic_name || med.genericName || '';

                let matchedMedicine: any = null;
                let alternatives: any[] = [];
                let confidence = 0;

                if (medName) {
                    const searchResults = await medicineRepository.searchByName(medName);

                    if (searchResults.length > 0) {
                        matchedMedicine = searchResults[0];
                        confidence = searchResults[0].name.toLowerCase() === medName.toLowerCase() ? 1.0 : 0.7;
                        alternatives = searchResults.slice(1, 4).map((m: any) => ({
                            id: m.id,
                            name: m.name,
                            mrp: m.mrp,
                            isGeneric: !!m.generic_name,
                        }));
                    }

                    if (!matchedMedicine && genericName) {
                        const genericResults = await medicineRepository.searchByName(genericName);
                        if (genericResults.length > 0) {
                            matchedMedicine = genericResults[0];
                            confidence = 0.5;
                            alternatives = genericResults.slice(1, 4).map((m: any) => ({
                                id: m.id,
                                name: m.name,
                                mrp: m.mrp,
                                isGeneric: true,
                            }));
                        }
                    }
                }

                return {
                    name: medName,
                    dosage: med.dosage || med.dose || '',
                    frequency: med.frequency || '',
                    duration: med.duration || '',
                    matchedMedicineId: matchedMedicine?.id,
                    matchedMedicineName: matchedMedicine?.name,
                    matchConfidence: confidence,
                    alternatives,
                };
            }),
        );

        return {
            prescriptionId,
            patientId: (prescription as any).patient_id,
            medicines: mappedMedicines,
        };
    }

    /**
     * Create order directly from a prescription.
     * Maps prescription → validates → creates order in one call.
     */
    async createOrderFromPrescription(
        patientId: string,
        prescriptionId: string,
        deliveryAddress: any,
        selectedMedicineIds?: string[],
    ): Promise<MedicineOrderWithDetails> {
        // 1. Map prescription to medicines
        const mapping = await this.mapPrescriptionToMedicines(prescriptionId);

        // 2. Verify patient owns this prescription
        if (mapping.patientId !== patientId) {
            throw new ForbiddenError('This prescription does not belong to you');
        }

        // 3. Check for existing order
        const existingOrder = await medicineOrderRepository.findByPrescriptionId(prescriptionId);
        if (existingOrder) {
            throw new BadRequestError('An order already exists for this prescription');
        }

        // 4. Build order items from matched medicines
        const items = mapping.medicines
            .filter(m => {
                if (!m.matchedMedicineId) return false;
                if (selectedMedicineIds?.length) return selectedMedicineIds.includes(m.matchedMedicineId);
                return true;
            })
            .map((m, index) => ({
                medicineId: m.matchedMedicineId!,
                quantity: 1,
                prescriptionItemIndex: index,
            }));

        if (items.length === 0) {
            throw new BadRequestError('No medicines from this prescription are available in our catalog');
        }

        // 5. Create the order
        const order = await this.createOrder(patientId, {
            prescriptionId,
            items,
            deliveryAddress,
        });

        // 6. Link order back to prescription
        await prescriptionRepository.markMedicineOrdered(prescriptionId, order.id);

        log.info('Order created from prescription', {
            prescriptionId,
            orderId: order.id,
            itemCount: items.length,
        });

        return order;
    }

    // ============================================================================
    // Analytics
    // ============================================================================

    async getOrderStats(
        userId: string,
        userRole: string,
        hospitalId?: string,
    ): Promise<MedicineOrderStats> {
        const stats = await medicineOrderRepository.getStats(hospitalId || userId);

        return {
            totalOrders: stats.totalOrders,
            pendingOrders: stats.pendingOrders,
            deliveredOrders: stats.deliveredOrders,
            cancelledOrders: stats.cancelledOrders,
            totalRevenue: stats.totalRevenue,
            platformCommission: stats.platformCommission,
            averageOrderValue: stats.deliveredOrders > 0 ? stats.totalRevenue / stats.deliveredOrders : 0,
        };
    }

    // ============================================================================
    // Medicine CRUD (Pharmacy / Admin)
    // ============================================================================

    async createMedicine(data: any) {
        const medicine = await medicineRepository.create({
            ...data,
            is_active: true,
            is_in_stock: (data.stock_quantity || 0) > 0,
        } as any);

        log.info('Medicine created', { id: medicine.id, name: data.name });
        return medicine;
    }

    async updateMedicine(id: string, data: any) {
        const existing = await medicineRepository.findById(id);
        if (!existing) throw new NotFoundError('Medicine not found');

        // If stock_quantity changed, update is_in_stock
        if (data.stock_quantity !== undefined) {
            data.is_in_stock = data.stock_quantity > 0;
        }

        const updated = await medicineRepository.update(id, {
            ...data,
            updated_at: new Date().toISOString(),
        } as any);

        log.info('Medicine updated', { id });
        return updated;
    }

    async deleteMedicine(id: string) {
        const existing = await medicineRepository.findById(id);
        if (!existing) throw new NotFoundError('Medicine not found');

        // Soft-delete
        await medicineRepository.update(id, {
            is_active: false,
            updated_at: new Date().toISOString(),
        } as any);

        log.info('Medicine deactivated', { id });
    }

    async listAllOrders(filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        const { data, total } = await medicineOrderRepository.listOrders({
            status: filters.status,
            page: filters.page || 1,
            limit: filters.limit || 20,
        });

        return { orders: data, total };
    }
}

export const medicineService = new MedicineService();

