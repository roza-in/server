// ============================================================================
// Settlement Module Types — aligned to migration 006 (settlements & payouts)
// ============================================================================

import type {
  Settlement,
  SettlementLineItem,
  Payout,
  PayoutAccount,
  SettlementInvoice,
  DailySettlementSummary,
} from '../../types/database.types.js';

// Re-export DB enums for module consumers
export type {
  SettlementStatus,
  SettlementFrequency,
  PayoutStatus,
  PayoutMode,
  KycStatus,
} from '../../types/database.types.js';

// Re-export DB row types
export type {
  Settlement,
  SettlementLineItem,
  Payout,
  PayoutAccount,
  SettlementInvoice,
  DailySettlementSummary,
};

// ============================================================================
// Response DTOs
// ============================================================================

/** Settlement with joined relations returned by findByIdWithRelations */
export interface SettlementWithRelations extends Settlement {
  settlement_line_items?: SettlementLineItem[];
  approved_by_user?: { id: string; name: string; email: string } | null;
  entity?: { id: string; name: string; slug?: string; city?: string; state?: string } | null;
}

/** Settlement list response */
export interface SettlementListResponse {
  data: Settlement[];
  total: number;
}

/** Settlement stats response returned to admin dashboard */
export interface SettlementStatsResponse {
  pendingCount: number;
  pendingAmount: number;
  processingCount: number;
  processingAmount: number;
  completedCount: number;
  completedAmount: number;
  totalNetPayable: number;
}

// ============================================================================
// Service Input Types (internal — validation lives in settlement.validator.ts)
// ============================================================================

export interface SettlementFilters {
  entityType?: string;
  entityId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

export interface CalculateSettlementInput {
  entityType: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
}

export interface CompleteSettlementInput {
  utrNumber: string;
}

