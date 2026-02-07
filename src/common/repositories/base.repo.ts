import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';

/**
 * Base Repository - Standardizes data access using Supabase
 * T is the type representing a row in the table
 */
export abstract class BaseRepository<T> {
    protected readonly supabase: SupabaseClient;
    protected readonly tableName: string;
    protected readonly log = logger;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.supabase = supabaseAdmin;
    }

    /**
     * Get a query builder for the table
     */
    protected getQuery() {
        return this.supabase.from(this.tableName);
    }

    /**
     * Find by ID
     */
    async findById(id: string): Promise<T | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            this.log.error(`Error in findById [${this.tableName}]:`, error);
            return null;
        }

        return data as T;
    }

    /**
     * Find all records (with pagination)
     */
    async findAll(page = 1, limit = 20): Promise<{ data: T[]; total: number }> {
        const offset = (page - 1) * limit;
        const { data, error, count } = await this.getQuery()
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error(`Error in findAll [${this.tableName}]:`, error);
            return { data: [], total: 0 };
        }

        return { data: data as T[], total: count || 0 };
    }

    /**
     * Find many records with filters
     * Note: Special filter keys like page, limit, sort_by, sort_order, search, etc.
     * are excluded from column equality filters and should be handled by the caller
     */
    async findMany(filters: Record<string, any> = {}, page = 1, limit = 20): Promise<{ data: T[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = this.getQuery().select('*', { count: 'exact' });

        // Keys that should NOT be treated as column equality filters
        const excludedKeys = [
            'page', 'limit', 'sort_by', 'sort_order', 'sortBy', 'sortOrder',
            'search', 'searchQuery', 'q', 'consultation_type', 'min_experience',
            'max_fee', 'min_fee', 'min_rating', 'max_rating'
        ];

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && !excludedKeys.includes(key)) {
                if (Array.isArray(value)) {
                    query = query.in(key, value);
                } else {
                    query = query.eq(key, value);
                }
            }
        }

        // Handle sorting if sort_by is provided
        const sortBy = filters.sort_by || filters.sortBy;
        const sortOrder = filters.sort_order || filters.sortOrder || 'desc';

        if (sortBy) {
            // Map common sort values to actual columns
            const sortColumnMap: Record<string, string> = {
                'rating': 'rating',
                'experience': 'experience_years',
                'fee_low': 'consultation_fee_in_person',
                'fee_high': 'consultation_fee_in_person',
                'name': 'name',
                'created': 'created_at',
                'doctors': 'total_doctors',
            };

            const column = sortColumnMap[sortBy] || sortBy;
            const ascending = sortBy === 'fee_low' || sortOrder === 'asc';
            query = query.order(column, { ascending });
        }

        const { data, error, count } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            this.log.error(`Error in findMany [${this.tableName}]:`, error);
            throw error;
        }

        return { data: data as T[], total: count || 0 };
    }

    /**
     * Create record
     */
    async create(data: Partial<T>): Promise<T | null> {
        const { data: created, error } = await this.getQuery()
            .insert(data as any)
            .select()
            .single();

        if (error) {
            this.log.error(`Error in create [${this.tableName}]:`, error);
            throw error;
        }

        return created as T;
    }

    /**
     * Update record
     */
    async update(id: string, updates: Partial<T>): Promise<T | null> {
        const { data, error } = await this.getQuery()
            .update(updates as any)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.log.error(`Error in update [${this.tableName}]:`, error);
            throw error;
        }

        return data as T;
    }

    /**
     * Delete record (soft delete usually handled by flags, this is hard delete)
     */
    async delete(id: string): Promise<boolean> {
        const { error } = await this.getQuery()
            .delete()
            .eq('id', id);

        if (error) {
            this.log.error(`Error in delete [${this.tableName}]:`, error);
            return false;
        }

        return true;
    }

    /**
     * Find by field
     * @param filters - Partial object to match against
     * @returns The first matching record or null
     */
    async findOne(filters: Partial<T>): Promise<T | null> {
        let query = this.getQuery().select('*');

        for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error in findOne [${this.tableName}]:`, error);
            return null;
        }

        return data as T;
    }

    /**
     * Execute a Supabase RPC (Postgres Function)
     * @param fn - Function name
     * @param params - Function parameters
     * @returns The result of the function execution
     */
    async rpc(fn: string, params?: any) {
        return this.supabase.rpc(fn, params);
    }
}
