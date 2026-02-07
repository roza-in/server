import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Medicine } from '../../types/database.types.js';

/**
 * Medicine Repository - Database operations for medicine catalog
 */
export class MedicineRepository extends BaseRepository<Medicine> {
    constructor() {
        super('medicines');
    }

    async search(filters: {
        query?: string;
        category?: string;
        schedule?: string;
        brand?: string;
        priceMin?: number;
        priceMax?: number;
        page: number;
        limit: number;
    }) {
        const offset = (filters.page - 1) * filters.limit;

        let query = this.getQuery()
            .select('*', { count: 'exact' })
            .eq('is_available', true)
            .eq('is_discontinued', false);

        if (filters.query) {
            query = query.textSearch('name', filters.query, { type: 'websearch' });
        }
        if (filters.category) {
            query = query.eq('category', filters.category);
        }
        if (filters.schedule) {
            query = query.eq('schedule', filters.schedule);
        }
        if (filters.brand) {
            query = query.ilike('brand', `%${filters.brand}%`);
        }
        if (filters.priceMin) {
            query = query.gte('mrp', filters.priceMin);
        }
        if (filters.priceMax) {
            query = query.lte('mrp', filters.priceMax);
        }

        const { data, error, count } = await query
            .order('name')
            .range(offset, offset + filters.limit - 1);

        if (error) {
            this.log.error('Error searching medicines', error);
            throw error;
        }

        return { medicines: data || [], total: count || 0 };
    }

    async findByIds(ids: string[]): Promise<Medicine[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .in('id', ids);

        if (error) throw error;
        return data || [];
    }
}

export const medicineRepository = new MedicineRepository();
