import { BaseRepository } from '../../common/repositories/base.repo.js';

export class CreditRepository extends BaseRepository<any> {
    constructor() {
        super('patient_credits');
    }

    async findByUserId(userId: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            return null;
        }
        return data;
    }

    async getOrCreate(userId: string): Promise<any> {
        const existing = await this.findByUserId(userId);
        if (existing) return existing;

        const { data, error } = await this.getQuery()
            .insert({ user_id: userId, balance: 0 })
            .select()
            .single();

        if (error) {
            this.log.error(`Error creating credit account for user ${userId}`, error);
            throw error;
        }
        return data;
    }

    async getTransactions(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.supabase
            .from('credit_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { data: data || [], total: count || 0 };
    }

    async addTransaction(txn: {
        credit_account_id: string;
        user_id: string;
        type: string;
        amount: number;
        balance_after: number;
        reference_type?: string;
        reference_id?: string;
        description?: string;
        expires_at?: string;
    }): Promise<any> {
        const { data, error } = await this.supabase
            .from('credit_transactions')
            .insert(txn)
            .select()
            .single();

        if (error) {
            this.log.error('Error creating credit transaction', error);
            throw error;
        }
        return data;
    }

    async updateBalance(userId: string, newBalance: number): Promise<void> {
        const { error } = await this.getQuery()
            .update({ balance: newBalance })
            .eq('user_id', userId);

        if (error) {
            this.log.error(`Error updating credit balance for user ${userId}`, error);
            throw error;
        }
    }
}

export const creditRepository = new CreditRepository();
