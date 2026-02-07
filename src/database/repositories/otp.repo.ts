import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { OtpCode } from '../../types/database.types.js';

/**
 * OTP Repository - Database operations for one-time passwords
 */
export class OTPRepository extends BaseRepository<OtpCode> {
    constructor() {
        super('otps');
    }

    /**
     * Find the latest valid OTP for an identifier and purpose
     */
    async findLatestValid(identifier: string, purpose: string): Promise<OtpCode | null> {
        const { data, error } = await this.getQuery()
            .select('*')
            .or(`phone.eq.${identifier},email.eq.${identifier}`)
            .eq('purpose', purpose)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding OTP for ${identifier}`, error);
            return null;
        }

        return data as OtpCode;
    }

    /**
     * Increment attempt counter
     */
    async incrementAttempts(id: string): Promise<void> {
        const { error } = await this.supabase.rpc('increment_otp_attempts', { otp_id: id });
        if (error) {
            this.log.error(`Error incrementing OTP attempts for ${id}`, error);
        }
    }

    /**
     * Clean up specific OTP (delete)
     */
    async cleanup(id: string): Promise<void> {
        await this.delete(id);
    }

    /**
     * Clean up expired OTPs
     */
    async cleanupExpired(): Promise<void> {
        const { error } = await this.getQuery()
            .delete()
            .lt('expires_at', new Date().toISOString());

        if (error) {
            this.log.error('Error cleaning up expired OTPs', error);
        }
    }
}

export const otpRepository = new OTPRepository();
