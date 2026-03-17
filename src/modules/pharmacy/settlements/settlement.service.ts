/**
 * Pharmacy Settlement Service
 * Business logic for pharmacy-specific settlement operations
 */

import { pharmacySettlementRepository } from '../../../database/repositories/pharmacy-settlement.repo.js';
import { medicineOrderRepository } from '../../../database/repositories/medicine-order.repo.js';
import { hospitalRepository } from '../../../database/repositories/hospital.repo.js';
import { NotFoundError, BadRequestError } from '../../../common/errors/index.js';
import { logger } from '../../../config/logger.js';
import type {
    CalculatePharmacySettlementInput,
    ProcessPharmacySettlementInput,
    PharmacySettlementFilters,
    PharmacySettlementWithDetails,
    PharmacySettlementStats,
} from './settlement.types.js';

const log = logger.child('PharmacySettlementService');

class PharmacySettlementService {
    /**
     * Calculate settlement for a hospital's medicine orders
     */
    async calculate(input: CalculatePharmacySettlementInput): Promise<PharmacySettlementWithDetails> {
        // Verify hospital exists
        const hospital = await hospitalRepository.findById(input.hospitalId);
        if (!hospital) throw new NotFoundError('Hospital not found');

        // Check for overlapping settlement periods
        const existing = await pharmacySettlementRepository.findByDateRange(
            input.hospitalId,
            input.periodStart,
            input.periodEnd
        );
        if (existing.length > 0) {
            throw new BadRequestError('A settlement already exists for this period');
        }

        // Get delivered orders for this period
        const { data: orders } = await medicineOrderRepository.listOrders({
            hospitalId: input.hospitalId,
            status: 'delivered',
        });

        // Filter orders by date range
        const periodOrders = (orders || []).filter((o: any) => {
            const deliveredAt = o.delivered_at || o.created_at;
            return deliveredAt >= input.periodStart && deliveredAt <= input.periodEnd;
        });

        const totalOrderValue = periodOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
        const commissionRate = (hospital as any).medicine_commission_percent || 10;
        const grossCommission = Math.round(totalOrderValue * commissionRate) / 100;
        const tdsAmount = Math.round(grossCommission * 0.01 * 100) / 100; // 1% TDS on commission
        const netPayable = totalOrderValue - grossCommission - tdsAmount;

        const settlementData = {
            hospital_id: input.hospitalId,
            period_start: input.periodStart,
            period_end: input.periodEnd,
            total_orders: periodOrders.length,
            total_order_value: totalOrderValue,
            commission_rate: commissionRate,
            gross_commission: grossCommission,
            tds_amount: tdsAmount,
            other_deductions: 0,
            net_payable: netPayable,
            status: 'pending' as const,
        };

        const created = await pharmacySettlementRepository.create(settlementData as any);
        log.info(`Pharmacy settlement calculated: ${created.id}`, { hospitalId: input.hospitalId });

        return this.getById(created.id);
    }

    /**
     * Get settlement by ID
     */
    async getById(id: string): Promise<PharmacySettlementWithDetails> {
        const result = await pharmacySettlementRepository.findByIdWithRelations(id);
        if (!result) throw new NotFoundError('Pharmacy settlement not found');
        return result;
    }

    /**
     * List settlements with filters
     */
    async list(filters: PharmacySettlementFilters) {
        const result = await pharmacySettlementRepository.listSettlements({
            hospitalId: filters.hospitalId,
            status: filters.status,
            startDate: filters.startDate,
            endDate: filters.endDate,
            page: filters.page,
            limit: filters.limit,
        });
        return { settlements: result.data, total: result.total };
    }

    /**
     * Get settlements for a specific hospital
     */
    async getHospitalSettlements(hospitalId: string, page = 1, limit = 20) {
        const result = await pharmacySettlementRepository.findByHospitalId(hospitalId, page, limit);
        return { settlements: result.data, total: result.total };
    }

    /**
     * Process settlement (start payout)
     */
    async processSettlement(
        settlementId: string,
        processedBy: string,
        input: ProcessPharmacySettlementInput
    ): Promise<PharmacySettlementWithDetails> {
        const settlement = await pharmacySettlementRepository.findById(settlementId);
        if (!settlement) throw new NotFoundError('Settlement not found');

        if (settlement.status !== 'pending') {
            throw new BadRequestError('Only pending settlements can be processed');
        }

        await pharmacySettlementRepository.update(settlementId, {
            status: 'processing',
            processed_by: processedBy,
            payment_mode: input.paymentMode,
            utr_number: input.utrNumber || null,
        } as any);

        log.info(`Pharmacy settlement processing initiated: ${settlementId}`, { processedBy });
        return this.getById(settlementId);
    }

    /**
     * Complete settlement
     */
    async completeSettlement(
        settlementId: string,
        utrNumber?: string
    ): Promise<PharmacySettlementWithDetails> {
        const settlement = await pharmacySettlementRepository.findById(settlementId);
        if (!settlement) throw new NotFoundError('Settlement not found');

        if (settlement.status !== 'processing') {
            throw new BadRequestError('Only processing settlements can be completed');
        }

        const updateData: any = {
            status: 'completed',
            processed_at: new Date().toISOString(),
        };
        if (utrNumber) updateData.utr_number = utrNumber;

        await pharmacySettlementRepository.update(settlementId, updateData);
        log.info(`Pharmacy settlement completed: ${settlementId}`);

        return this.getById(settlementId);
    }

    /**
     * Get settlement statistics
     */
    async getStats(hospitalId?: string): Promise<PharmacySettlementStats> {
        return pharmacySettlementRepository.getStats(hospitalId);
    }
}

export const pharmacySettlementService = new PharmacySettlementService();
