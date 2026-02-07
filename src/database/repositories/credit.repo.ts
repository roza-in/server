import { BaseRepository } from '../../common/repositories/base.repo.js';

export class CreditRepository extends BaseRepository<any> {
    constructor() {
        super('credits');
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
}

export const creditRepository = new CreditRepository();
