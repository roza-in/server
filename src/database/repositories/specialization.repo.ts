import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface SpecializationRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    long_description: string | null;
    icon_url: string | null;
    banner_url: string | null;
    meta_title: string | null;
    meta_description: string | null;
    og_image_url: string | null;
    common_conditions: string[] | null;
    search_keywords: string[] | null;
    faq_content: any | null;
    parent_id: string | null;
    is_active: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
}

/**
 * Specialization Repository - Database operations for medical specializations
 */
export class SpecializationRepository extends BaseRepository<SpecializationRow> {
    constructor() {
        super('specializations');
    }

    /**
     * List all active specializations ordered by display_order
     */
    async listAll(): Promise<SpecializationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            this.log.error('Failed to fetch specializations', error);
            throw error;
        }

        return data || [];
    }

    /**
     * List only active specializations (for public-facing pages)
     */
    async findActive(): Promise<SpecializationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            this.log.error('Failed to fetch active specializations', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Find specialization by slug (for SEO-friendly URLs)
     */
    async findBySlug(slug: string): Promise<SpecializationRow | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Failed to fetch specialization by slug: ${slug}`, error);
            throw error;
        }

        return data;
    }

    /**
     * Find child specializations by parent_id
     */
    async findByParentId(parentId: string): Promise<SpecializationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('parent_id', parentId)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Find top-level specializations (no parent)
     */
    async findTopLevel(): Promise<SpecializationRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .is('parent_id', null)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }
}

export const specializationRepository = new SpecializationRepository();
