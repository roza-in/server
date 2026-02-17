import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface RatingHelpfulnessRow {
    id: string;
    rating_id: string;
    user_id: string;
    is_helpful: boolean;
    created_at: string;
}

/**
 * Rating Helpfulness Repository - "Was this review helpful?" votes
 */
export class RatingHelpfulnessRepository extends BaseRepository<RatingHelpfulnessRow> {
    constructor() {
        super('rating_helpfulness');
    }

    /**
     * Vote on a rating's helpfulness (upsert)
     */
    async vote(ratingId: string, userId: string, isHelpful: boolean) {
        const { data, error } = await this.supabase
            .from('rating_helpfulness')
            .upsert(
                {
                    rating_id: ratingId,
                    user_id: userId,
                    is_helpful: isHelpful,
                },
                { onConflict: 'rating_id,user_id' }
            )
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get helpfulness counts for a rating
     */
    async getCounts(ratingId: string) {
        const { data, error } = await this.supabase
            .from('rating_helpfulness')
            .select('is_helpful')
            .eq('rating_id', ratingId);

        if (error) throw error;

        const items = data || [];
        return {
            helpful: items.filter(i => i.is_helpful).length,
            not_helpful: items.filter(i => !i.is_helpful).length,
            total: items.length,
        };
    }

    /**
     * Check if user already voted on a rating
     */
    async findUserVote(ratingId: string, userId: string): Promise<RatingHelpfulnessRow | null> {
        return this.findOne({ rating_id: ratingId, user_id: userId } as any);
    }

    /**
     * Remove a vote
     */
    async removeVote(ratingId: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase
            .from('rating_helpfulness')
            .delete()
            .eq('rating_id', ratingId)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    }
}

export const ratingHelpfulnessRepository = new RatingHelpfulnessRepository();
