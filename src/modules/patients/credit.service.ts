import { creditRepository } from '../../database/repositories/credit.repo.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import { logger } from '../../config/logger.js';

/**
 * Credit Service — manages patient credit/wallet balance
 */
class CreditService {
    private log = logger.child('CreditService');

    /**
     * Get credit balance for a user
     */
    async getBalance(userId: string): Promise<any> {
        const credit = await creditRepository.getOrCreate(userId);
        return {
            userId,
            balance: credit.balance || 0,
            updatedAt: credit.updated_at,
        };
    }

    /**
     * Get credit transaction history
     */
    async getTransactions(userId: string, page = 1, limit = 20) {
        const result = await creditRepository.getTransactions(userId, page, limit);
        return {
            transactions: result.data,
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    }

    /**
     * Add credit (admin operation — refund, promo, etc.)
     */
    async addCredit(
        userId: string,
        amount: number,
        description: string,
        referenceType?: string,
        referenceId?: string,
        expiresAt?: string
    ): Promise<any> {
        if (amount <= 0) {
            throw new BadRequestError('Credit amount must be positive');
        }

        const account = await creditRepository.getOrCreate(userId);
        const newBalance = (account.balance || 0) + amount;

        const txn = await creditRepository.addTransaction({
            credit_account_id: account.id,
            user_id: userId,
            type: 'credit',
            amount,
            balance_after: newBalance,
            reference_type: referenceType,
            reference_id: referenceId,
            description,
            expires_at: expiresAt,
        });

        await creditRepository.updateBalance(userId, newBalance);

        return { transaction: txn, newBalance };
    }

    /**
     * Deduct credit (used during payment)
     */
    async deductCredit(
        userId: string,
        amount: number,
        description: string,
        referenceType?: string,
        referenceId?: string
    ): Promise<any> {
        if (amount <= 0) {
            throw new BadRequestError('Deduction amount must be positive');
        }

        const account = await creditRepository.getOrCreate(userId);
        if ((account.balance || 0) < amount) {
            throw new BadRequestError('Insufficient credit balance');
        }

        const newBalance = account.balance - amount;

        const txn = await creditRepository.addTransaction({
            credit_account_id: account.id,
            user_id: userId,
            type: 'debit',
            amount,
            balance_after: newBalance,
            reference_type: referenceType,
            reference_id: referenceId,
            description,
        });

        await creditRepository.updateBalance(userId, newBalance);

        return { transaction: txn, newBalance };
    }
}

export const creditService = new CreditService();
