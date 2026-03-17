import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';
import type { PaginatedMeta } from './admin.types.js';

/**
 * Admin Finance Service
 *
 * Handles financial governance queries:
 *   - Payment disputes
 *   - GST ledger
 *   - Financial ledger (read-only)
 *   - Reconciliation records
 *   - Hold funds
 *   - Commission slabs
 */
class AdminFinanceService {
    private supabase = supabaseAdmin;
    private log = logger.child('AdminFinanceService');

    // =========================================================================
    // PAYMENT DISPUTES
    // =========================================================================

    async listDisputes(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('payment_disputes')
            .select('*', { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.disputeType) query = query.eq('dispute_type', filters.disputeType);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);
        if (filters.search) {
            const s = sanitizeSearchInput(filters.search);
            if (s) query = query.or(`payment_id.ilike.%${s}%,reason.ilike.%${s}%,gateway_dispute_id.ilike.%${s}%`);
        }

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list disputes', error);
            throw new BadRequestError('Failed to list disputes');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getDisputeStats() {
        const [
            { count: total },
            { count: open },
            { count: underReview },
            { count: resolved },
            { count: evidenceDue },
        ] = await Promise.all([
            this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true }),
            this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true }).eq('status', 'open' as any),
            this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true }).eq('status', 'under_review' as any),
            this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true }).in('status', ['won', 'lost', 'closed']),
            this.supabase.from('payment_disputes').select('id', { count: 'exact', head: true })
                .not('evidence_due_by', 'is', null)
                .gt('evidence_due_by', new Date().toISOString())
                .in('status', ['open', 'under_review']),
        ]);

        // Total disputed amount
        const { data: amountData } = await this.supabase
            .from('payment_disputes')
            .select('amount')
            .in('status', ['open', 'under_review'])
            .limit(10000);

        const totalDisputedAmount = (amountData || []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

        return {
            total: total ?? 0,
            open: open ?? 0,
            underReview: underReview ?? 0,
            resolved: resolved ?? 0,
            evidenceDue: evidenceDue ?? 0,
            totalDisputedAmount,
        };
    }

    async getDispute(id: string) {
        const { data, error } = await this.supabase
            .from('payment_disputes')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) throw new NotFoundError('Dispute not found');
        return data;
    }

    async updateDisputeStatus(id: string, body: { status: string; resolutionNotes?: string; amountDeducted?: number }) {
        const update: Record<string, any> = {
            status: body.status,
            updated_at: new Date().toISOString(),
        };
        if (body.resolutionNotes) update.resolution_notes = body.resolutionNotes;
        if (body.amountDeducted !== undefined) update.amount_deducted = body.amountDeducted;
        if (['won', 'lost', 'closed'].includes(body.status)) {
            update.resolved_at = new Date().toISOString();
        }

        const { data, error } = await this.supabase
            .from('payment_disputes')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update dispute', error);
            throw new BadRequestError('Failed to update dispute');
        }
        return data;
    }

    // =========================================================================
    // GST LEDGER
    // =========================================================================

    async listGstEntries(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('gst_ledger')
            .select('*', { count: 'exact' });

        if (filters.isFiled !== undefined) query = query.eq('is_filed', filters.isFiled === 'true' || filters.isFiled === true);
        if (filters.hsnCode) query = query.eq('hsn_sac_code', filters.hsnCode);
        if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
        if (filters.endDate) query = query.lte('transaction_date', filters.endDate);
        if (filters.transactionType) query = query.eq('transaction_type', filters.transactionType);

        const { data, error, count } = await query
            .order('transaction_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list GST entries', error);
            throw new BadRequestError('Failed to list GST entries');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getGstStats() {
        const [
            { count: total },
            { count: filed },
            { count: unfiled },
        ] = await Promise.all([
            this.supabase.from('gst_ledger').select('id', { count: 'exact', head: true }),
            this.supabase.from('gst_ledger').select('id', { count: 'exact', head: true }).eq('is_filed', true),
            this.supabase.from('gst_ledger').select('id', { count: 'exact', head: true }).eq('is_filed', false),
        ]);

        // Tax totals
        const { data: taxData } = await this.supabase
            .from('gst_ledger')
            .select('cgst_amount, sgst_amount, igst_amount, total_tax, taxable_amount')
            .limit(10000);

        const totals = (taxData || []).reduce(
            (acc: any, r: any) => ({
                cgst: acc.cgst + Number(r.cgst_amount || 0),
                sgst: acc.sgst + Number(r.sgst_amount || 0),
                igst: acc.igst + Number(r.igst_amount || 0),
                totalTax: acc.totalTax + Number(r.total_tax || 0),
                taxableAmount: acc.taxableAmount + Number(r.taxable_amount || 0),
            }),
            { cgst: 0, sgst: 0, igst: 0, totalTax: 0, taxableAmount: 0 }
        );

        return { total: total ?? 0, filed: filed ?? 0, unfiled: unfiled ?? 0, ...totals };
    }

    async markGstFiled(ids: string[], returnPeriod: string) {
        const { data, error } = await this.supabase
            .from('gst_ledger')
            .update({
                is_filed: true,
                filed_in_return: returnPeriod,
                filing_date: new Date().toISOString().split('T')[0],
            } as any)
            .in('id', ids)
            .select();

        if (error) {
            this.log.error('Failed to mark GST entries as filed', error);
            throw new BadRequestError('Failed to mark GST entries as filed');
        }
        return { updated: data?.length ?? 0 };
    }

    // =========================================================================
    // FINANCIAL LEDGER (READ-ONLY — immutable double-entry)
    // =========================================================================

    async listLedgerEntries(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('financial_ledger')
            .select('*', { count: 'exact' });

        if (filters.accountType) query = query.eq('account_type', filters.accountType);
        if (filters.entryType) query = query.eq('entry_type', filters.entryType);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);
        if (filters.referenceType) query = query.eq('reference_type', filters.referenceType);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list ledger entries', error);
            throw new BadRequestError('Failed to list ledger entries');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getLedgerSummary() {
        const { data } = await this.supabase
            .from('financial_ledger')
            .select('account_type, entry_type, amount')
            .limit(10000);

        const summary: Record<string, { credits: number; debits: number; net: number }> = {};

        (data || []).forEach((entry: any) => {
            if (!summary[entry.account_type]) {
                summary[entry.account_type] = { credits: 0, debits: 0, net: 0 };
            }
            const amount = Number(entry.amount || 0);
            if (entry.entry_type === 'credit') {
                summary[entry.account_type].credits += amount;
            } else {
                summary[entry.account_type].debits += amount;
            }
            summary[entry.account_type].net = summary[entry.account_type].credits - summary[entry.account_type].debits;
        });

        return summary;
    }

    // =========================================================================
    // RECONCILIATION RECORDS
    // =========================================================================

    async listReconRecords(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('reconciliation_records')
            .select('*', { count: 'exact' });

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.gatewayProvider) query = query.eq('gateway_provider', filters.gatewayProvider);
        if (filters.startDate) query = query.gte('reconciliation_date', filters.startDate);
        if (filters.endDate) query = query.lte('reconciliation_date', filters.endDate);

        const { data, error, count } = await query
            .order('reconciliation_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list reconciliation records', error);
            throw new BadRequestError('Failed to list reconciliation records');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getReconStats() {
        const [
            { count: total },
            { count: matched },
            { count: mismatched },
            { count: pending },
            { count: resolved },
            { count: writeOff },
        ] = await Promise.all([
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }),
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'matched' as any),
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'mismatched' as any),
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'pending' as any),
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'resolved' as any),
            this.supabase.from('reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'write_off' as any),
        ]);

        // Total discrepancy from mismatched
        const { data: discData } = await this.supabase
            .from('reconciliation_records')
            .select('discrepancy_amount')
            .eq('status', 'mismatched' as any)
            .limit(10000);

        const totalDiscrepancy = (discData || []).reduce((s: number, r: any) => s + Math.abs(Number(r.discrepancy_amount || 0)), 0);

        return {
            total: total ?? 0,
            matched: matched ?? 0,
            mismatched: mismatched ?? 0,
            pending: pending ?? 0,
            resolved: resolved ?? 0,
            writeOff: writeOff ?? 0,
            totalDiscrepancy,
        };
    }

    async resolveRecon(id: string, notes: string, resolvedBy: string) {
        const { data, error } = await this.supabase
            .from('reconciliation_records')
            .update({
                status: 'resolved',
                resolution_notes: notes,
                resolved_by: resolvedBy,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to resolve reconciliation', error);
            throw new BadRequestError('Failed to resolve reconciliation record');
        }
        return data;
    }

    async writeOffRecon(id: string, resolvedBy: string) {
        const { data, error } = await this.supabase
            .from('reconciliation_records')
            .update({
                status: 'write_off',
                resolution_notes: 'Written off as small discrepancy',
                resolved_by: resolvedBy,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to write off reconciliation', error);
            throw new BadRequestError('Failed to write off reconciliation');
        }
        return data;
    }

    // =========================================================================
    // HOLD FUNDS
    // =========================================================================

    async listHoldFunds(filters: any = {}) {
        const page = Number(filters.page) || 1;
        const limit = Math.min(Number(filters.limit) || 20, 100);
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('hold_funds')
            .select('*', { count: 'exact' });

        if (filters.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive === 'true' || filters.isActive === true);
        }
        if (filters.entityType) query = query.eq('entity_type', filters.entityType);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate) query = query.lte('created_at', filters.endDate);

        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Failed to list hold funds', error);
            throw new BadRequestError('Failed to list hold funds');
        }

        const meta: PaginatedMeta = { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
        return { data: data || [], meta };
    }

    async getHoldFundStats() {
        const [
            { count: total },
            { count: active },
            { count: released },
        ] = await Promise.all([
            this.supabase.from('hold_funds').select('id', { count: 'exact', head: true }),
            this.supabase.from('hold_funds').select('id', { count: 'exact', head: true }).eq('is_active', true),
            this.supabase.from('hold_funds').select('id', { count: 'exact', head: true }).eq('is_active', false),
        ]);

        const { data: amountData } = await this.supabase
            .from('hold_funds')
            .select('amount')
            .eq('is_active', true)
            .limit(10000);

        const totalHeldAmount = (amountData || []).reduce((s: number, h: any) => s + Number(h.amount || 0), 0);

        return {
            total: total ?? 0,
            active: active ?? 0,
            released: released ?? 0,
            totalHeldAmount,
        };
    }

    async releaseHoldFund(id: string, reason: string, releasedBy: string) {
        const { data, error } = await this.supabase
            .from('hold_funds')
            .update({
                is_active: false,
                released_at: new Date().toISOString(),
                released_by: releasedBy,
                release_reason: reason,
                updated_at: new Date().toISOString(),
            } as any)
            .eq('id', id)
            .eq('is_active', true)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to release hold fund', error);
            throw new BadRequestError('Failed to release hold fund');
        }
        return data;
    }

    // =========================================================================
    // COMMISSION SLABS
    // =========================================================================

    async listCommissionSlabs() {
        const { data, error } = await this.supabase
            .from('commission_slabs')
            .select('*')
            .order('min_monthly_revenue', { ascending: true });

        if (error) {
            this.log.error('Failed to list commission slabs', error);
            throw new BadRequestError('Failed to list commission slabs');
        }
        return data || [];
    }

    async createCommissionSlab(body: {
        name: string;
        description?: string;
        minMonthlyRevenue: number;
        maxMonthlyRevenue?: number;
        consultationCommissionPercent: number;
        medicineCommissionPercent: number;
    }) {
        const { data, error } = await this.supabase
            .from('commission_slabs')
            .insert({
                name: body.name,
                description: body.description || null,
                min_monthly_revenue: body.minMonthlyRevenue,
                max_monthly_revenue: body.maxMonthlyRevenue || null,
                consultation_commission_percent: body.consultationCommissionPercent,
                medicine_commission_percent: body.medicineCommissionPercent,
                is_active: true,
            } as any)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to create commission slab', error);
            throw new BadRequestError('Failed to create commission slab');
        }
        return data;
    }

    async updateCommissionSlab(id: string, body: Record<string, any>) {
        const update: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) update.name = body.name;
        if (body.description !== undefined) update.description = body.description;
        if (body.minMonthlyRevenue !== undefined) update.min_monthly_revenue = body.minMonthlyRevenue;
        if (body.maxMonthlyRevenue !== undefined) update.max_monthly_revenue = body.maxMonthlyRevenue;
        if (body.consultationCommissionPercent !== undefined) update.consultation_commission_percent = body.consultationCommissionPercent;
        if (body.medicineCommissionPercent !== undefined) update.medicine_commission_percent = body.medicineCommissionPercent;

        const { data, error } = await this.supabase
            .from('commission_slabs')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to update commission slab', error);
            throw new BadRequestError('Failed to update commission slab');
        }
        return data;
    }

    async toggleCommissionSlab(id: string, isActive: boolean) {
        const { data, error } = await this.supabase
            .from('commission_slabs')
            .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error('Failed to toggle commission slab', error);
            throw new BadRequestError('Failed to toggle commission slab');
        }
        return data;
    }

    // =========================================================================
    // BULK OPERATIONS
    // ===================================
    async bulkApproveSettlements(ids: string[], adminId: string) {
        const { data, error } = await this.supabase
            .from('settlements')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: adminId,
                updated_at: new Date().toISOString(),
            } as any)
            .in('id', ids)
            .eq('status', 'pending' as any)
            .select();

        if (error) {
            this.log.error('Failed to bulk approve settlements', error);
            throw new BadRequestError('Failed to bulk approve settlements');
        }
        return { count: data?.length || 0 };
    }

    async bulkApproveRefunds(ids: string[], adminId: string) {
        const { data, error } = await this.supabase
            .from('refunds')
            .update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                processed_by: adminId,
                updated_at: new Date().toISOString(),
            } as any)
            .in('id', ids)
            .eq('status', 'pending' as any)
            .select();

        if (error) {
            this.log.error('Failed to bulk approve refunds', error);
            throw new BadRequestError('Failed to bulk approve refunds');
        }
        return { count: data?.length || 0 };
    }
}

export const adminFinanceService = new AdminFinanceService();
