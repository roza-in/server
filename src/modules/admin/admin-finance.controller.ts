import { Request, Response } from 'express';
import { adminFinanceService } from './admin-finance.service.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess } from '../../common/responses/success.response.js';

// ============================================================================
// DISPUTES
// ============================================================================

export const listDisputes = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminFinanceService.listDisputes(req.query);
    return sendSuccess(res, data, 'Disputes fetched', 200, meta);
});

export const getDisputeStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.getDisputeStats();
    return sendSuccess(res, result, 'Dispute stats fetched');
});

export const getDispute = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.getDispute(req.params.id);
    return sendSuccess(res, result, 'Dispute fetched');
});

export const updateDispute = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.updateDisputeStatus(req.params.id, req.body);
    return sendSuccess(res, result, 'Dispute updated');
});

// ============================================================================
// GST LEDGER
// ============================================================================

export const listGstEntries = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminFinanceService.listGstEntries(req.query);
    return sendSuccess(res, data, 'GST entries fetched', 200, meta);
});

export const getGstStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.getGstStats();
    return sendSuccess(res, result, 'GST stats fetched');
});

export const markGstFiled = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.markGstFiled(req.body.ids, req.body.returnPeriod);
    return sendSuccess(res, result, 'GST entries marked as filed');
});

// ============================================================================
// FINANCIAL LEDGER (read-only)
// ============================================================================

export const listLedgerEntries = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminFinanceService.listLedgerEntries(req.query);
    return sendSuccess(res, data, 'Ledger entries fetched', 200, meta);
});

export const getLedgerSummary = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.getLedgerSummary();
    return sendSuccess(res, result, 'Ledger summary fetched');
});

// ============================================================================
// RECONCILIATION
// ============================================================================

export const listReconRecords = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminFinanceService.listReconRecords(req.query);
    return sendSuccess(res, data, 'Reconciliation records fetched', 200, meta);
});

export const getReconStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.getReconStats();
    return sendSuccess(res, result, 'Reconciliation stats fetched');
});

export const resolveRecon = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.resolveRecon(req.params.id, req.body.notes, (req as any).user?.id);
    return sendSuccess(res, result, 'Reconciliation resolved');
});

export const writeOffRecon = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.writeOffRecon(req.params.id, (req as any).user?.id);
    return sendSuccess(res, result, 'Reconciliation written off');
});

// ============================================================================
// HOLD FUNDS
// ============================================================================

export const listHoldFunds = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await adminFinanceService.listHoldFunds(req.query);
    return sendSuccess(res, data, 'Hold funds fetched', 200, meta);
});

export const getHoldFundStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.getHoldFundStats();
    return sendSuccess(res, result, 'Hold fund stats fetched');
});

export const releaseHoldFund = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.releaseHoldFund(req.params.id, req.body.reason, (req as any).user?.id);
    return sendSuccess(res, result, 'Hold fund released');
});

// ============================================================================
// COMMISSION SLABS
// ============================================================================

export const listCommissionSlabs = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminFinanceService.listCommissionSlabs();
    return sendSuccess(res, result, 'Commission slabs fetched');
});

export const createCommissionSlab = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.createCommissionSlab(req.body);
    return sendSuccess(res, result, 'Commission slab created', 201);
});

export const updateCommissionSlab = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.updateCommissionSlab(req.params.id, req.body);
    return sendSuccess(res, result, 'Commission slab updated');
});

export const toggleCommissionSlab = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminFinanceService.toggleCommissionSlab(req.params.id, req.body.isActive);
    return sendSuccess(res, result, 'Commission slab toggled');
});
