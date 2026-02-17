/**
 * Module-level Refund Repository
 *
 * Re-exports the canonical refund repository from database/repositories.
 * This file exists for module-local convenience. All actual logic lives in the
 * database-level repository to follow the founder structure pattern.
 */
export { refundRepository, RefundRepository } from '../../database/repositories/refund.repo.js';
