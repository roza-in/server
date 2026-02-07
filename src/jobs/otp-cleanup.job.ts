import { otpRepository } from '../database/repositories/otp.repo.js';
import { logger } from '../config/logger.js';

/**
 * Clean up expired OTPs from the database
 */
export const cleanupExpiredOTPs = async () => {
    const log = logger.child('Job:OTPCleanup');
    try {
        log.info('Starting expired OTP cleanup...');
        await otpRepository.cleanupExpired();
        log.info('Expired OTP cleanup completed.');
    } catch (error) {
        log.error('Failed to cleanup expired OTPs:', error);
    }
};
