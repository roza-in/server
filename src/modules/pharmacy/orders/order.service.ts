/**
 * Pharmacy Order Service
 * Handles medicine ordering, payment processing, and fulfillment
 */

import { logger } from '../../../config/logger.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../common/errors/index.js';
import { medicineRepository } from '../../../database/repositories/medicine.repo.js';
import { pharmacyRepository } from '../../../database/repositories/pharmacy.repo.js';
import { medicineOrderRepository } from '../../../database/repositories/medicine-order.repo.js';
import { medicineService } from '../medicines/medicine.service.js';
import { GST_RATE } from '../../../config/constants.js';
import type {
    Medicine,
    Pharmacy,
    MedicineOrder,
    MedicineOrderStatus,
    FulfillmentType,
    PaymentStatus
} from '../../../types/database.types.js';
import type {
    CreateMedicineOrderInput,
    OrderPricingBreakdown,
    MedicineOrderWithDetails,
    MedicineOrderStats
} from './order.types.js';

const log = logger.child('OrderService');

// Commission rate for medicine orders
const MEDICINE_COMMISSION_PERCENT = 5;
const DELIVERY_BASE_FEE = 40;

class OrderService {
    // ============================================================================
    // Order Creation
    // ============================================================================

    async createOrder(
        patientId: string,
        input: CreateMedicineOrderInput
    ): Promise<MedicineOrderWithDetails> {
        log.info('Creating medicine order', { patientId, fulfillmentType: input.fulfillmentType });

        // Validate idempotency
        if (input.idempotencyKey) {
            const existing = await this.getOrderByIdempotencyKey(input.idempotencyKey);
            if (existing) {
                log.info('Returning existing order for idempotency key', { orderId: existing.id });
                return existing;
            }
        }

        // Get pharmacy if specified
        let pharmacy: Pharmacy | null = null;
        if (input.pharmacyId) {
            pharmacy = await pharmacyRepository.findById(input.pharmacyId);
            if (!pharmacy) {
                throw new NotFoundError('Pharmacy not found');
            }
            if (!pharmacy.is_active || pharmacy.verification_status !== 'verified') {
                throw new BadRequestError('Pharmacy is not available');
            }
        }

        // Validate fulfillment type requirements
        if (input.fulfillmentType === 'platform_delivery' && !input.deliveryAddress && !input.deliveryAddressId) {
            throw new BadRequestError('Delivery address is required for platform delivery');
        }

        if (input.fulfillmentType === 'hospital_pharmacy' && !pharmacy?.hospital_id) {
            throw new BadRequestError('Hospital pharmacy fulfillment requires a hospital pharmacy');
        }

        // Get medicine details
        const medicineIds = input.items.map(item => item.medicineId);
        const medicines = await medicineRepository.findByIds(medicineIds);

        if (medicines.length !== medicineIds.length) {
            throw new BadRequestError('Some medicines not found');
        }

        // Check Inventory
        await medicineService.checkStockAvailability(input.items);

        // Check prescription requirements
        const prescriptionRequired = medicines.some(m => m.is_prescription_required);
        if (prescriptionRequired && !input.prescriptionId) {
            throw new BadRequestError('Prescription is required for some medicines');
        }

        // Calculate pricing
        const pricing = this.calculateOrderPricing(
            medicines,
            input.items,
            input.fulfillmentType,
            pharmacy
        );

        // Prepare delivery address
        const deliveryAddress = input.fulfillmentType === 'platform_delivery'
            ? input.deliveryAddress
            : null;

        // Create order
        const orderData = {
            patient_id: patientId,
            family_member_id: input.familyMemberId || null,
            prescription_id: input.prescriptionId || null,
            fulfillment_type: input.fulfillmentType,
            pharmacy_id: input.pharmacyId || null,
            delivery_address: deliveryAddress,
            subtotal: pricing.subtotal,
            discount_amount: pricing.discountAmount,
            delivery_fee: pricing.deliveryFee,
            platform_fee: pricing.platformFee,
            gst_amount: pricing.gstAmount,
            total_amount: pricing.totalAmount,
            pharmacy_amount: pricing.pharmacyAmount,
            platform_commission: pricing.platformCommission,
            status: 'pending' as MedicineOrderStatus,
            payment_status: 'pending' as PaymentStatus,
            prescription_verified: false,
            idempotency_key: input.idempotencyKey || null,
            placed_at: new Date().toISOString(),
        };

        const orderItems = input.items.map((item, index) => {
            const medicine = medicines.find(m => m.id === item.medicineId)!;
            return {
                medicine_id: item.medicineId,
                prescription_item_index: item.prescriptionItemIndex,
                quantity: item.quantity,
                unit_price: medicine.mrp,
                discount_percent: 0,
                subtotal: medicine.mrp * item.quantity,
                medicine_name: medicine.name,
                medicine_brand: medicine.brand || null,
                dosage: medicine.strength || null,
                is_substitute: false,
                original_medicine_id: null,
                substitution_approved: false,
            };
        });

        const order = await medicineOrderRepository.createOrder(orderData as any, orderItems);

        // Deduct Stock
        // Note: For pending orders, we reserve stock. If payment fails, we restore it.
        // Or wait for payment? Ideally deduct now to prevent overselling.
        for (const item of input.items) {
            await medicineService.updateStock(item.medicineId, -item.quantity);
        }

        log.info('Medicine order created', { orderId: order.id, orderNumber: order.order_number });

        return order as MedicineOrderWithDetails;
    }

    calculateOrderPricing(
        medicines: Medicine[],
        items: { medicineId: string; quantity: number }[],
        fulfillmentType: FulfillmentType,
        pharmacy: Pharmacy | null
    ): OrderPricingBreakdown {
        // Calculate subtotal
        let subtotal = 0;
        for (const item of items) {
            const medicine = medicines.find(m => m.id === item.medicineId);
            if (medicine) {
                subtotal += medicine.mrp * item.quantity;
            }
        }

        // Discount (could be from coupon, pharmacy discount, etc.)
        const discountAmount = 0;

        // Delivery fee
        let deliveryFee = 0;
        if (fulfillmentType === 'platform_delivery') {
            deliveryFee = DELIVERY_BASE_FEE;
        }

        // Platform fee (commission)
        const commissionRate = pharmacy?.platform_commission_percent || MEDICINE_COMMISSION_PERCENT;
        const platformCommission = Math.round((subtotal * commissionRate) / 100);

        // GST on platform fee
        const gstAmount = Math.round((platformCommission * GST_RATE) / 100);

        // Platform fee = commission + GST
        const platformFee = platformCommission + gstAmount;

        // Pharmacy gets: subtotal - commission
        const pharmacyAmount = subtotal - platformCommission;

        // Total = subtotal + delivery - discount
        const totalAmount = subtotal + deliveryFee - discountAmount;

        return {
            subtotal,
            discountAmount,
            deliveryFee,
            platformFee,
            gstAmount,
            totalAmount,
            pharmacyAmount,
            platformCommission,
        };
    }

    // ============================================================================
    // Order Management
    // ============================================================================

    async getOrderById(orderId: string, userId?: string, userRole?: string): Promise<MedicineOrderWithDetails> {
        const order = await medicineOrderRepository.getOrderById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Check access - patient or pharmacy owner or admin
        if (userRole !== 'admin' && userId) {
            if (order.patient_id === userId) {
                return order as MedicineOrderWithDetails;
            }
            // Check if user is pharmacy owner
            if (order.pharmacy_id) {
                const pharmacy = await pharmacyRepository.findById(order.pharmacy_id);
                if (pharmacy?.owner_user_id === userId) {
                    return order as MedicineOrderWithDetails;
                }
            }
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
        // Pending implementation if repository supports it
        return null;
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

        return {
            orders: data,
            total
        };
    }

    async listPharmacyOrders(pharmacyId: string, filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        const { data, total } = await medicineOrderRepository.listOrders({
            pharmacyId,
            status: filters.status,
            page: filters.page || 1,
            limit: filters.limit || 20,
        });

        return {
            orders: data,
            total
        };
    }

    // ============================================================================
    // Order Status Updates
    // ============================================================================

    async confirmOrder(
        pharmacyUserId: string,
        orderId: string,
        estimatedReadyTime?: string,
        notes?: string
    ): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        // Validate pharmacy ownership
        if (order.pharmacy_id) {
            const pharmacy = await pharmacyRepository.findById(order.pharmacy_id);
            if (pharmacy?.owner_user_id !== pharmacyUserId) {
                throw new ForbiddenError('Only pharmacy owner can confirm orders');
            }
        }

        if (order.status !== 'pending') {
            throw new BadRequestError(`Cannot confirm order in ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, {
            status: 'confirmed',
            pharmacy_notes: notes,
            estimated_ready_time: estimatedReadyTime,
        } as any);

        return this.getOrderById(orderId);
    }

    async markAsProcessing(pharmacyUserId: string, orderId: string): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'confirmed') {
            throw new BadRequestError(`Cannot mark as processing from ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, { status: 'processing' } as any);
        return this.getOrderById(orderId);
    }

    async markAsReady(pharmacyUserId: string, orderId: string): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'processing') {
            throw new BadRequestError(`Cannot mark as ready from ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, { status: 'ready_for_pickup' } as any);
        return this.getOrderById(orderId);
    }

    async dispatchOrder(
        pharmacyUserId: string,
        orderId: string,
        deliveryPartnerId?: string,
        trackingId?: string
    ): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'ready_for_pickup' && order.status !== 'processing') {
            throw new BadRequestError(`Cannot dispatch from ${order.status} status`);
        }

        if (order.fulfillment_type !== 'platform_delivery') {
            throw new BadRequestError('Only platform delivery orders can be dispatched');
        }

        // Generate delivery OTP
        const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

        await medicineOrderRepository.update(orderId, {
            status: 'out_for_delivery',
            delivery_partner_id: deliveryPartnerId,
            delivery_tracking_id: trackingId,
            delivery_otp: deliveryOtp,
        } as any);

        return this.getOrderById(orderId);
    }

    async completeDelivery(orderId: string, otp: string): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        if (order.status !== 'out_for_delivery' && order.status !== 'ready_for_pickup') {
            throw new BadRequestError(`Cannot complete from ${order.status} status`);
        }

        // Verify OTP for delivery
        if (order.fulfillment_type === 'platform_delivery' && order.delivery_otp !== otp) {
            throw new BadRequestError('Invalid delivery OTP');
        }

        await medicineOrderRepository.update(orderId, { status: 'delivered' } as any);
        return this.getOrderById(orderId);
    }

    async cancelOrder(
        userId: string,
        orderId: string,
        reason: string
    ): Promise<MedicineOrder> {
        const order = await this.getOrderById(orderId);

        // Check if user can cancel
        const canCancel = ['pending', 'confirmed'].includes(order.status);
        if (!canCancel) {
            throw new BadRequestError(`Cannot cancel order in ${order.status} status`);
        }

        await medicineOrderRepository.update(orderId, {
            status: 'cancelled',
            cancellation_reason: reason,
            cancelled_by: userId,
        } as any);

        // Restore Stock
        const orderDetails = await this.getOrderById(orderId); // Get full details with items
        if (orderDetails.items) {
            for (const item of orderDetails.items) {
                await medicineService.updateStock(item.medicine_id, item.quantity);
            }
        }

        return this.getOrderById(orderId);
    }

    // ============================================================================
    // Analytics
    // ============================================================================

    async getOrderStats(
        userId: string,
        userRole: 'patient' | 'pharmacy',
        pharmacyId?: string
    ): Promise<MedicineOrderStats> {
        if (userRole === 'pharmacy') {
            if (!pharmacyId) {
                const pharmacy = await pharmacyRepository.findOne({ owner_user_id: userId } as any);
                pharmacyId = pharmacy?.id;
            }
            if (!pharmacyId) {
                throw new NotFoundError('Pharmacy not found');
            }
        }

        const stats = await medicineOrderRepository.getStats(pharmacyId || userId);

        return {
            totalOrders: stats.totalOrders,
            pendingOrders: stats.pendingOrders,
            deliveredOrders: stats.deliveredOrders,
            cancelledOrders: stats.cancelledOrders,
            totalRevenue: stats.totalRevenue,
            platformCommission: stats.platformCommission,
            averageOrderValue: stats.totalOrders > 0 ? stats.totalRevenue / stats.deliveredOrders : 0,
            ordersByStatus: {} as any,
            ordersByFulfillmentType: {} as any,
        };
    }
}

export const orderService = new OrderService();
