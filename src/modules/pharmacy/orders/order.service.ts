/**
 * Pharmacy Order Service
 * Thin delegate to MedicineService — all order logic is centralized there.
 * This module exists so that /pharmacy/orders routes can import from their
 * co-located service file while the canonical implementation lives once in
 * medicines/medicine.service.ts.
 *
 * Aligned to migration 007 — centralized ROZX pharmacy model
 */

import { medicineService } from '../medicines/medicine.service.js';
import type { MedicineOrderStatus } from '../../../types/database.types.js';
import type {
    CreateMedicineOrderInput,
    MedicineOrderWithDetails,
    MedicineOrderStats,
} from './order.types.js';

class OrderService {
    // ============================================================================
    // Order Creation — delegates to medicineService
    // ============================================================================

    async createOrder(
        patientId: string,
        input: CreateMedicineOrderInput,
    ): Promise<MedicineOrderWithDetails> {
        return medicineService.createOrder(patientId, input as any);
    }

    // ============================================================================
    // Order Queries
    // ============================================================================

    async getOrderById(orderId: string, userId?: string): Promise<MedicineOrderWithDetails> {
        return medicineService.getOrderById(orderId, userId);
    }

    async getOrderByNumber(orderNumber: string): Promise<MedicineOrderWithDetails> {
        return medicineService.getOrderByNumber(orderNumber);
    }

    async listPatientOrders(patientId: string, filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        return medicineService.listPatientOrders(patientId, filters);
    }

    async listHospitalOrders(hospitalId: string, filters: {
        status?: MedicineOrderStatus;
        page?: number;
        limit?: number;
    }) {
        return medicineService.listHospitalOrders(hospitalId, filters);
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
        return medicineService.confirmOrder(userId, orderId, estimatedReadyTime, notes);
    }

    async markAsProcessing(userId: string, orderId: string): Promise<MedicineOrderWithDetails> {
        return medicineService.markAsProcessing(userId, orderId);
    }

    async markAsReady(userId: string, orderId: string): Promise<MedicineOrderWithDetails> {
        return medicineService.markAsReady(userId, orderId);
    }

    async dispatchOrder(
        userId: string,
        orderId: string,
        deliveryPartner?: string,
        trackingId?: string,
    ): Promise<MedicineOrderWithDetails> {
        return medicineService.dispatchOrder(userId, orderId, deliveryPartner, trackingId);
    }

    async completeDelivery(orderId: string, otp: string): Promise<MedicineOrderWithDetails> {
        return medicineService.completeDelivery(orderId, otp);
    }

    async cancelOrder(
        userId: string,
        orderId: string,
        reason: string,
    ): Promise<MedicineOrderWithDetails> {
        return medicineService.cancelOrder(userId, orderId, reason);
    }

    // ============================================================================
    // Analytics
    // ============================================================================

    async getOrderStats(
        userId: string,
        userRole: string,
        hospitalId?: string,
    ): Promise<MedicineOrderStats> {
        return medicineService.getOrderStats(userId, userRole, hospitalId);
    }
}

export const orderService = new OrderService();
