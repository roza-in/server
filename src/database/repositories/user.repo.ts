import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { User } from '../../types/database.types.js';

/**
 * User Repository - Database operations for users
 */
export class UserRepository extends BaseRepository<User> {
    constructor() {
        super('users');
    }

    /**
     * Find user by phone number
     */
    async findByPhone(phone: string): Promise<User | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('phone', phone)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding user by phone: ${phone}`, error);
            return null;
        }

        return data as User;
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .ilike('email', email)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding user by email: ${email}`, error);
            return null;
        }

        return data as User;
    }

    /**
     * Find user by phone or email
     */
    async findByPhoneOrEmail(identifier: string): Promise<User | null> {
        if (identifier.includes('@')) {
            return this.findByEmail(identifier);
        }
        return this.findByPhone(identifier);
    }

    /**
     * Get user with relations and details
     */
    /**
     * Get user with relations and details
     */
    async findWithDetails(userIdOrPhone: string): Promise<any> {
        const isEmail = userIdOrPhone.includes('@');
        const field = isEmail ? 'email' : (userIdOrPhone.length > 20 ? 'id' : 'phone');

        // 1. Get User base record
        const { data: user, error } = await this.getQuery()
            .select('*')
            .eq(field, userIdOrPhone)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding user with details: ${userIdOrPhone}`, error);
            return null;
        }

        // 2. Fetch relations manually (more robust than embedding if constraint names mismatch)
        const [doctorsResult, hospitalsResult, staffResult] = await Promise.all([
            this.supabase
                .from('doctors')
                .select('*')
                .eq('user_id', user.id),

            this.supabase
                .from('hospitals')
                .select('*')
                .eq('admin_user_id', user.id),

            // Query hospital_staff for reception and other staff roles
            this.supabase
                .from('hospital_staff')
                .select('*, hospital:hospital_id(*)')
                .eq('user_id', user.id)
                .eq('is_active', true)
        ]);

        // 3. Attach relations
        return {
            ...user,
            doctors: doctorsResult.data || [],
            hospitals: hospitalsResult.data || [],
            staff: staffResult.data || []
        };
    }

    /**
     * Update user profile information
     */
    async updateProfile(id: string, updates: Partial<User>): Promise<User | null> {
        return this.update(id, updates);
    }

    /**
     * Get user statistics (Admin only)
     */
    async getStats(): Promise<any> {
        const { data, error } = await this.getQuery()
            .select('role', { count: 'exact' });

        if (error) throw error;

        const stats = {
            total: data.length,
            patients: data.filter((u: any) => u.role === 'patient').length,
            doctors: data.filter((u: any) => u.role === 'doctor').length,
            hospitals: data.filter((u: any) => u.role === 'hospital_admin').length,
        };

        return stats;
    }
}

export const userRepository = new UserRepository();
