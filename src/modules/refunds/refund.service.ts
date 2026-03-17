import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import { refundRepository } from '../../database/repositories/refund.repo.js';
import { paymentRepository } from '../../database/repositories/payment.repo.js';
import type { RefundFilters, CreateRefundInput, ProcessRefundInput, RefundStats } from './refund.types.js';

/**
 * Refund Service - Domain module for refund management
 */
class RefundService {
    private log = logger.child('RefundService');

    /**
     * Create refund request
     */
    async create(input: CreateRefundInput, requestedBy: string) {
        // Get payment to validate
        const payment = await paymentRepository.findById(input.payment_id);

        if (!payment) {
            throw new NotFoundError('Payment not found');
        }

        if (payment.status !== 'completed') {
            throw new BadRequestError('Payment is not in a refundable state');
        }

        if (input.refund_amount > payment.total_amount - payment.total_refunded) {
            throw new BadRequestError('Refund amount exceeds available refundable amount');
        }

        const refund = await refundRepository.create({
            payment_id: input.payment_id,
            refund_amount: input.refund_amount,
            reason: input.reason,
            reason_details: input.reason_details || null,
            cancellation_fee: input.cancellation_fee || 0,
            policy_applied: input.policy_applied || null,
            status: 'pending',
            initiated_by: requestedBy,
            initiated_at: new Date().toISOString(),
        } as any);

        return refund;
    }

    /**
     * List refunds with filters
     */
    async list(filters: RefundFilters) {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 100);

        const dbFilters: Record<string, any> = {};
        if (filters.payment_id) dbFilters.payment_id = filters.payment_id;
        if (filters.status) dbFilters.status = filters.status;
        if (filters.reason) dbFilters.reason = filters.reason;
        if (filters.initiated_by) dbFilters.initiated_by = filters.initiated_by;

        const result = await refundRepository.findMany(dbFilters, page, limit);

        return {
            data: result.data || [],
            total: result.total || 0,
            page,
            limit,
        };
    }

    /**
     * Get refund by ID with relations
     */
    async getById(refundId: string) {
        const refund = await refundRepository.findByIdWithRelations(refundId);
        if (!refund) {
            throw new NotFoundError('Refund not found');
        }
        return refund;
    }

    /**
     * Process refund (approve/reject) - admin action
     */
    async process(refundId: string, input: ProcessRefundInput) {
        const existing = await this.getById(refundId);

        if (existing.status !== 'pending') {
            throw new BadRequestError('Refund is not in pending status');
        }

        const update: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (input.action === 'approve') {
            update.status = 'approved';
            update.approved_at = new Date().toISOString();

            // Update payment's total_refunded
            await paymentRepository.update(existing.payment_id, {
                total_refunded: (existing as any).payments?.total_refunded
                    ? Number((existing as any).payments.total_refunded) + existing.refund_amount
                    : existing.refund_amount,
                status: 'refunded',
                updated_at: new Date().toISOString(),
            } as any);
        } else {
            update.status = 'rejected';
            update.status_reason = input.notes || 'Rejected by admin';
        }

        const refund = await refundRepository.update(refundId, update);
        return refund;
    }

    /**
     * Get refund stats
     */
    async getStats(): Promise<RefundStats> {
        const { pending, completed, totalCount } = await refundRepository.getStats();

        const pendingAmount = pending.reduce((s: number, r: any) => s + Number(r.refund_amount), 0);
        const completedAmount = completed.reduce((s: number, r: any) => s + Number(r.refund_amount), 0);

        return {
            totalRefunds: totalCount,
            pendingAmount,
            completedAmount,
            pendingCount: pending.length,
            completedCount: completed.length,
        };
    }
}

export const refundService = new RefundService();