import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import { settlementRepository } from '../../database/repositories/settlement.repo.js';
import { paymentRepository } from '../../database/repositories/payment.repo.js';
import type {
  SettlementFilters,
  SettlementListResponse,
  SettlementStatsResponse,
  CalculateSettlementInput,
  CompleteSettlementInput,
  SettlementWithRelations,
} from './settlement.types.js';

/**
 * Settlement Service — domain logic for entity payouts (hospitals / pharmacies)
 */
class SettlementService {
  private log = logger.child('SettlementService');

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /** Paginated list with optional filters (admin) */
  async list(filters: SettlementFilters): Promise<SettlementListResponse> {
    return settlementRepository.listSettlements({
      entityType: filters.entityType,
      entityId: filters.entityId,
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit,
    });
  }

  /** Get single settlement with line items + entity */
  async getById(settlementId: string): Promise<SettlementWithRelations> {
    const settlement = await settlementRepository.findByIdWithRelations(settlementId);
    if (!settlement) throw new NotFoundError('Settlement not found');
    return settlement as SettlementWithRelations;
  }

  /** Settlements for a specific entity (hospital "my" view) */
  async getEntitySettlements(
    entityType: string,
    entityId: string,
    page: number,
    limit: number,
  ): Promise<SettlementListResponse> {
    return settlementRepository.findByEntity(entityType, entityId, page, limit);
  }

  /** Aggregated stats (count + sum per status) */
  async getStats(filters?: { entityType?: string; entityId?: string }): Promise<SettlementStatsResponse> {
    const raw = await settlementRepository.getStats(filters);

    const pending = raw['pending'] || { count: 0, amount: 0 };
    const processing = raw['processing'] || { count: 0, amount: 0 };
    const completed = raw['completed'] || { count: 0, amount: 0 };

    return {
      pendingCount: pending.count,
      pendingAmount: pending.amount,
      processingCount: processing.count,
      processingAmount: processing.amount,
      completedCount: completed.count,
      completedAmount: completed.amount,
      totalNetPayable: pending.amount + processing.amount + completed.amount,
    };
  }

  // --------------------------------------------------------------------------
  // Commands
  // --------------------------------------------------------------------------

  /**
   * Calculate & create a new settlement for the given entity + period.
   * Pulls completed payments via paymentRepository.getStats and builds line items.
   */
  async calculate(input: CalculateSettlementInput) {
    const { entityType, entityId, periodStart, periodEnd } = input;

    // Guard: no overlapping non-cancelled settlements
    const existing = await settlementRepository.findOverlapping(entityType, entityId, periodStart, periodEnd);
    if (existing) {
      throw new BadRequestError(
        `Overlapping settlement ${existing.settlement_number || existing.id} already exists for this period`,
      );
    }

    // Fetch completed + refunded payments in the period
    const { completed: payments, refunded } = await paymentRepository.getStats({
      hospital_id: entityType === 'hospital' ? entityId : undefined,
      date_from: periodStart,
      date_to: periodEnd,
    });

    const grossAmount = payments.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const commissionAmount = payments.reduce((s, p) => s + Number(p.platform_commission || 0), 0);
    const refundsAmount = refunded.reduce((s, p) => s + Number(p.total_refunded || 0), 0);
    const tdsAmount = 0; // TDS calculated externally or via config
    const otherDeductions = 0;
    const netPayable = grossAmount - commissionAmount - refundsAmount - tdsAmount - otherDeductions;

    const settlementNumber = `SET/${entityType.toUpperCase().slice(0, 3)}/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;

    // Create settlement row
    const settlement = await settlementRepository.create({
      settlement_number: settlementNumber,
      entity_type: entityType,
      entity_id: entityId,
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount: grossAmount,
      refunds_amount: refundsAmount,
      commission_amount: commissionAmount,
      tds_amount: tdsAmount,
      other_deductions: otherDeductions,
      deduction_details: null,
      net_payable: Math.max(netPayable, 0),
      status: 'pending' as const,
    } as any);

    // Create line items for each payment
    if (payments.length > 0) {
      const lineItems = payments.map((p) => ({
        settlement_id: settlement.id,
        transaction_type: 'payment',
        transaction_id: p.id,
        transaction_date: p.created_at,
        gross_amount: Number(p.total_amount || 0),
        commission_amount: Number(p.platform_commission || 0),
        net_amount: Number(p.net_payable || 0),
        description: `Payment ${p.id}`,
      }));

      await settlementRepository.createLineItems(lineItems);
    }

    // Line items for refunds
    if (refunded.length > 0) {
      const refundItems = refunded.map((r) => ({
        settlement_id: settlement.id,
        transaction_type: 'refund',
        transaction_id: r.id,
        transaction_date: r.created_at,
        gross_amount: -Number(r.total_refunded || 0),
        commission_amount: 0,
        net_amount: -Number(r.total_refunded || 0),
        description: `Refund for payment ${r.id}`,
      }));

      await settlementRepository.createLineItems(refundItems);
    }

    this.log.info(`Settlement ${settlement.id} created for ${entityType}/${entityId}`);
    return settlement;
  }

  /** Admin approves a pending settlement */
  async approve(settlementId: string, approvedByUserId: string) {
    const settlement = await this.getById(settlementId);

    if (settlement.status !== 'pending') {
      throw new BadRequestError('Only pending settlements can be approved');
    }

    const updated = await settlementRepository.update(settlementId, {
      status: 'processing' as any,
      approved_by: approvedByUserId,
      approved_at: new Date().toISOString(),
    } as any);

    this.log.info(`Settlement ${settlementId} approved by ${approvedByUserId}`);
    return updated;
  }

  /** Initiate payout (after approval) */
  async initiatePayout(settlementId: string) {
    const settlement = await this.getById(settlementId);

    if (settlement.status !== 'processing') {
      throw new BadRequestError('Settlement must be in processing status to initiate payout');
    }

    const updated = await settlementRepository.update(settlementId, {
      processed_at: new Date().toISOString(),
    } as any);

    this.log.info(`Payout initiated for settlement ${settlementId}`);
    return updated;
  }

  /** Mark settlement as completed with UTR */
  async complete(settlementId: string, input: CompleteSettlementInput) {
    const settlement = await this.getById(settlementId);

    if (settlement.status !== 'processing') {
      throw new BadRequestError('Settlement must be in processing status to complete');
    }

    const updated = await settlementRepository.update(settlementId, {
      status: 'completed' as any,
      utr_number: input.utrNumber,
    } as any);

    this.log.info(`Settlement ${settlementId} completed with UTR ${input.utrNumber}`);
    return updated;
  }
}

export const settlementService = new SettlementService();

