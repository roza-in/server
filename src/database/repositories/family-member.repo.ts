import { BaseRepository } from '../../common/repositories/base.repo.js';

/**
 * Family Member Repository - Database operations for family members
 */
export class FamilyMemberRepository extends BaseRepository<any> {
    constructor() {
        super('family_members');
    }

    /**
     * Find family member by user ID and family member ID
     */
    async findByUserAndId(userId: string, id: string) {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Family member not found for user: ${userId}, id: ${id}`, error);
            return null;
        }

        return data;
    }
}

export const familyMemberRepository = new FamilyMemberRepository();
