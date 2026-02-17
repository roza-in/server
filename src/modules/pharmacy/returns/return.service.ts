/**
 * Medicine Return Service
 * Business logic for medicine return/refund flow
 */

import { medicineReturnRepository } from '../../../database/repositories/medicine-return.repo.js';
import { medicineOrderRepository } from '../../../database/repositories/medicine-order.repo.js';
import { NotFoundError, BadRequestError } from '../../../common/errors/index.js';
import { logger } from '../../../config/logger.js';
import type { CreateReturnInput, ReviewReturnInput, ReturnFilters, MedicineReturnWithDetails, ReturnStats } from './return.types.js';

const log = logger.child('ReturnService');

class ReturnService {
    /**
     * Initiate a return for an order
     */
    async createReturn(
        userId: string,
        orderId: string,
        input: CreateReturnInput
    ): Promise<MedicineReturnWithDetails> {
        // Verify the order exists and belongs to user
        const order = await medicineOrderRepository.getOrderById(orderId);
        if (!order) throw new NotFoundError('Order not found');
        if (order.patient_id !== userId) throw new BadRequestError('Order does not belong to this user');

        // Only allow returns on delivered orders
        if (order.status !== 'delivered') {
            throw new BadRequestError('Returns can only be initiated for delivered orders');
        }

        // Check if return already exists for this order
        const existingReturns = await medicineReturnRepository.findByOrderId(orderId);
        const activeReturn = existingReturns.find(r => !['rejected', 'cancelled'].includes(r.status));
        if (activeReturn) {
            throw new BadRequestError('An active return already exists for this order');
        }

        const returnData = {
            order_id: orderId,
            reason: input.reason,
            reason_details: input.reasonDetails || null,
            items: input.items as any,
            photos: input.photos || null,
            refund_amount: input.refundAmount || order.total_amount,
            status: 'pending',
            initiated_by: userId,
            initiated_at: new Date().toISOString(),
        };

        const created = await medicineReturnRepository.create(returnData as any);
        log.info(`Medicine return initiated: ${created.id}`, { orderId });

        return this.getReturnById(created.id);
    }

    /**
     * Get return by ID with details
     */
    async getReturnById(id: string): Promise<MedicineReturnWithDetails> {
        const result = await medicineReturnRepository.findByIdWithRelations(id);
        if (!result) throw new NotFoundError('Return not found');
        return result;
    }

    /**
     * Get return by return number
     */
    async getReturnByNumber(returnNumber: string): Promise<MedicineReturnWithDetails> {
        const result = await medicineReturnRepository.findByReturnNumber(returnNumber);
        if (!result) throw new NotFoundError('Return not found');
        return this.getReturnById(result.id);
    }

    /**
     * List returns for a patient
     */
    async listPatientReturns(patientId: string, filters: ReturnFilters) {
        const result = await medicineReturnRepository.listReturns({
            ...filters,
            patientId,
        });
        return { returns: result.data, total: result.total };
    }

    /**
     * List all returns (admin/pharmacy)
     */
    async listReturns(filters: ReturnFilters) {
        const result = await medicineReturnRepository.listReturns(filters);
        return { returns: result.data, total: result.total };
    }

    /**
     * Review a return (approve/reject) — admin/pharmacy only
     */
    async reviewReturn(
        reviewerId: string,
        returnId: string,
        input: ReviewReturnInput
    ): Promise<MedicineReturnWithDetails> {
        const returnRecord = await medicineReturnRepository.findById(returnId);
        if (!returnRecord) throw new NotFoundError('Return not found');

        if (returnRecord.status !== 'pending') {
            throw new BadRequestError('Only pending returns can be reviewed');
        }

        const updateData: any = {
            status: input.status,
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
            review_notes: input.reviewNotes || null,
        };

        if (input.status === 'approved') {
            if (input.refundAmount !== undefined) {
                updateData.refund_amount = input.refundAmount;
            }
            if (input.schedulePickup) {
                updateData.pickup_scheduled_at = new Date().toISOString();
            }
        }

        await medicineReturnRepository.update(returnId, updateData);
        log.info(`Return ${returnId} reviewed: ${input.status}`, { reviewerId });

        return this.getReturnById(returnId);
    }

    /**
     * Mark pickup as completed
     */
    async completePickup(returnId: string): Promise<MedicineReturnWithDetails> {
        const returnRecord = await medicineReturnRepository.findById(returnId);
        if (!returnRecord) throw new NotFoundError('Return not found');

        if (returnRecord.status !== 'approved') {
            throw new BadRequestError('Only approved returns can have pickup completed');
        }

        await medicineReturnRepository.update(returnId, {
            pickup_completed_at: new Date().toISOString(),
            status: 'completed',
        } as any);

        log.info(`Return pickup completed: ${returnId}`);
        return this.getReturnById(returnId);
    }

    /**
     * Get return statistics
     */
    async getStats(hospitalId?: string): Promise<ReturnStats> {
        return medicineReturnRepository.getStats(hospitalId);
    }
}

export const returnService = new ReturnService();
