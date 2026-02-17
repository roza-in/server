import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Medicine } from '../../types/database.types.js';
import { sanitizeSearchInput } from '../../common/utils/sanitize.js';

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
            .eq('is_active', true)
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

    /**
     * Search medicines by name or generic name (for prescription matching)
     * Returns best matches first — exact matches, then partial
     */
    async searchByName(name: string, limit = 5): Promise<Medicine[]> {
        // Try exact match first
        const { data: exact, error: exactErr } = await this.getQuery()
            .select('*')
            .eq('is_active', true)
            .ilike('name', name)
            .limit(1);

        if (exactErr) throw exactErr;
        if (exact && exact.length > 0) {
            // Get alternatives via generic name match
            const { data: alts } = await this.getQuery()
                .select('*')
                .eq('is_active', true)
                .or(`generic_name.ilike.%${sanitizeSearchInput(name)}%,name.ilike.%${sanitizeSearchInput(name)}%`)
                .neq('id', exact[0].id)
                .limit(limit - 1);

            return [...exact, ...(alts || [])] as Medicine[];
        }

        // Fuzzy: partial name match + generic name match
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('is_active', true)
            .or(`name.ilike.%${sanitizeSearchInput(name)}%,generic_name.ilike.%${sanitizeSearchInput(name)}%`)
            .limit(limit);

        if (error) throw error;
        return (data || []) as Medicine[];
    }

    /**
     * Find medicine by slug (for SEO-friendly pages)
     */
    async findBySlug(slug: string): Promise<Medicine | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data as Medicine;
    }
}

export const medicineRepository = new MedicineRepository();
