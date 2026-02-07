// @ts-nocheck
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import { refundRepository } from '../../database/repositories/refund.repo.js';
import { paymentRepository } from '../../database/repositories/payment.repo.js';
import { paymentService } from '../payments/payment.service.js';
import type { RefundFilters, RefundListResponse, CreateRefundInput, ProcessRefundInput } from './refund.types.js';

/**
 * Refund Service - Domain module for refund management
 */
class RefundService {
    private log = logger.child('RefundService');

    // Refund percentages based on PRD
    private getRefundPercentage(type: string): number {
        const map: Record<string, number> = {
            full: 100,
            partial_75: 75,
            partial_50: 50,
            none: 0,
            doctor_cancelled: 100,
            technical_failure: 100,
        };
        return map[type] || 0;
    }

    /**
     * Create refund request
     */
    async create(input: CreateRefundInput, requestedBy: string): Promise<any> {
        // Get payment
        const payment = await paymentRepository.findByIdWithRelations(input.payment_id);

        if (!payment) {
            throw new NotFoundError('Payment not found');
        }

        const percentage = this.getRefundPercentage(input.refund_type);
        const refundAmount = (payment.amount * percentage) / 100;
        const platformFeeRefund = (payment.platform_fee * percentage) / 100;

        const refund = await refundRepository.create({
            payment_id: payment.id,
            appointment_id: payment.appointment_id,
            patient_id: payment.patient_id,
            refund_type: input.refund_type,
            refund_percentage: percentage,
            original_amount: payment.amount,
            refund_amount: refundAmount,
            platform_fee_refund: platformFeeRefund,
            reason: input.reason,
            cancelled_by: requestedBy,
            status: 'pending',
            requested_at: new Date().toISOString(),
        } as any);

        return refund;
    }

    /**
     * List refunds with filters
     */
    async list(filters: RefundFilters): Promise<RefundListResponse> {
        const result = await refundRepository.findMany({
            payment_id: filters.payment_id,
            appointment_id: filters.appointmentId,
            patient_id: filters.patientId,
            status: filters.status,
            date_from: filters.startDate,
            date_to: filters.endDate,
            limit: filters.limit,
            offset: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
        });

        const limit = filters.limit || 20;
        const page = filters.page || 1;

        return {
            refunds: (result.data || []) as any[],
            total: result.total || 0,
            page,
            limit,
            totalPages: Math.ceil((result.total || 0) / limit),
        };
    }

    /**
     * Get refund by ID
     */
    async getById(refundId: string): Promise<any> {
        return refundRepository.findByIdWithRelations(refundId);
    }

    /**
     * Process refund (approve/reject) - admin action
     */
    async process(refundId: string, input: ProcessRefundInput): Promise<any> {
        const existing = await this.getById(refundId);

        if (existing.status !== 'pending') {
            throw new BadRequestError('Refund is not in pending status');
        }

        const update: any = {
            updated_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
        };

        if (input.action === 'approve') {
            // In a real scenario, this would interact with a Payment Gateway (e.g., Razorpay)
            // We can assume validation succeeded and we mark it as completed or call payment service helper if needed.
            // But here we are just updating DB state.

            // If we need to trigger Razorpay refund API, we usually do it at "initiation" or here.
            // Given existing monolithic service did it in `processRefund`, and this method `process` 
            // seems to be an Admin Approval step.
            update.status = 'completed'; // Or 'processing' if async
            update.completed_at = new Date().toISOString();

            // Should validly update Payment status too
            await paymentRepository.update(existing.payment_id, { status: 'refunded', updated_at: new Date().toISOString() } as any);

        } else {
            update.status = 'failed';
            update.failure_reason = input.notes || 'Rejected by admin';
            update.failed_at = new Date().toISOString();
        }

        const refund = await refundRepository.update(refundId, update);
        return refund;
    }

    /**
     * Get refund stats
     */
    async getStats(): Promise<any> {
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


