/**
 * Module-level Settlement Repository
 *
 * Re-exports the canonical settlement repository from database/repositories.
 * This file exists for module-local convenience. All actual logic lives in the
 * database-level repository to follow the founder structure pattern.
 *
 * NOTE: The table is `settlements` (not `hospital_settlements`).
 * Columns: `period_start/period_end` (not `settlement_period_start/end`),
 *          `net_payable` (not `net_settlement`).
 */
export { settlementRepository, SettlementRepository } from '../../database/repositories/settlement.repo.js';
